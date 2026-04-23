require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

let userState = {};

// ===================== GET =====================
app.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const token = req.query["hub.verify_token"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }

  res.send("👗 StyleHub Running");
});

// ===================== POST =====================
app.post("/", async (req, res) => {
  try {
    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;

    const text = message.text?.body?.toLowerCase();
    const buttonReply = message.interactive?.button_reply?.id;
    const listReply = message.interactive?.list_reply?.id;

    if (!userState[from]) {
      userState[from] = { step: "start", cart: [] };
    }

    console.log("User:", text || buttonReply || listReply);

    // ===== FLOW =====

    if (text === "hi" || text === "hello") {
      await sendWelcome(from);
    }

    else if (buttonReply === "browse") {
      await sendCategories(from);
    }

    else if (listReply === "women") {
      await sendWomenProducts(from);
    }

    else if (listReply === "men") {
      await sendMenProducts(from);
    }

    // SELECT PRODUCT
    else if (buttonReply === "floral_dress" || buttonReply === "party_gown" || buttonReply === "shirt") {
      userState[from].item = buttonReply;
      await askSize(from);
    }

    // SIZE
    else if (["S","M","L"].includes(buttonReply)) {
      userState[from].size = buttonReply;
      addToCart(from);
      await showCart(from);
    }

    else if (buttonReply === "add_more") {
      await sendCategories(from);
    }

    else if (buttonReply === "checkout") {
      userState[from].step = "address";
      await askAddress(from);
    }

    else if (userState[from].step === "address") {
      userState[from].address = text;
      await confirmOrder(from);
    }

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// ===================== SEND =====================
async function sendMessage(data) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    data,
    {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}

// ===================== UI =====================

// 👋 Welcome
async function sendWelcome(to) {
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: "👗 *StyleHub*\n\n✨ Premium Fashion\n🔥 Trending Styles\n🚚 Fast Delivery\n\nStart shopping 👇"
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: { id: "browse", title: "🛍️ Browse Collection" }
          }
        ]
      }
    }
  });
}

// 🛍️ Categories
async function sendCategories(to) {
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: "Choose category 👇" },
      action: {
        button: "View",
        sections: [
          {
            title: "Collections",
            rows: [
              { id: "women", title: "👗 Women" },
              { id: "men", title: "👔 Men" }
            ]
          }
        ]
      }
    }
  });
}

// 👗 WOMEN PRODUCTS (CARD STYLE)
async function sendWomenProducts(to) {

  // Product 1
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: {
      link: "https://images.unsplash.com/photo-1520975922284-9e0ce8270d0b"
    },
    caption:
`🌸 *Floral Dress*

✨ Elegant & Casual  
⭐ 4.5 Rating  

💰 *₹999*  
🚚 Free Delivery`
  });

  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Choose 👇" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "floral_dress", title: "🛒 Add to Cart" } }
        ]
      }
    }
  });

  // Product 2
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: {
      link: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c"
    },
    caption:
`👗 *Party Gown*

🔥 Premium Party Wear  
⭐ 4.7 Rating  

💰 *₹1999*  
✨ Best Seller`
  });

  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Choose 👇" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "party_gown", title: "🛒 Add to Cart" } }
        ]
      }
    }
  });
}

// 👔 MEN PRODUCTS
async function sendMenProducts(to) {
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: {
      link: "https://images.unsplash.com/photo-1520975698519-59f7c8d9b5d3"
    },
    caption:
`👔 *Casual Shirt*

🔥 Trending Style  
⭐ 4.3 Rating  

💰 *₹799*`
  });

  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Choose 👇" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "shirt", title: "🛒 Add to Cart" } }
        ]
      }
    }
  });
}

// 📏 SIZE
async function askSize(to) {
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Select Size 👇" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "S", title: "S" } },
          { type: "reply", reply: { id: "M", title: "M" } },
          { type: "reply", reply: { id: "L", title: "L" } }
        ]
      }
    }
  });
}

// 🛒 CART
function addToCart(user) {
  const { item, size } = userState[user];
  userState[user].cart.push({ item, size });
}

async function showCart(to) {
  let text = "🛒 *Your Cart*\n\n";

  userState[to].cart.forEach(c => {
    text += `✨ ${c.item} (Size: ${c.size})\n`;
  });

  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text },
      action: {
        buttons: [
          { type: "reply", reply: { id: "add_more", title: "➕ Continue" } },
          { type: "reply", reply: { id: "checkout", title: "📦 Checkout" } }
        ]
      }
    }
  });
}

// 📍 ADDRESS
async function askAddress(to) {
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    text: { body: "📍 Enter your address:" }
  });
}

// ✅ CONFIRM
async function confirmOrder(to) {
  let text = "✅ *Order Confirmed*\n\n";

  userState[to].cart.forEach(c => {
    text += `✨ ${c.item} (Size: ${c.size})\n`;
  });

  text += `\n📍 ${userState[to].address}\n\n❤️ Thank you!`;

  await sendMessage({
    messaging_product: "whatsapp",
    to,
    text: { body: text }
  });

  userState[to] = { step: "start", cart: [] };
}

// =====================
app.listen(PORT, () => console.log("🚀 Running"));