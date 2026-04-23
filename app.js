require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// 🧠 State (temporary)
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

  res.send("👗 Dress Shop Bot Running");
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

    else if (listReply === "men") {
      await sendMenCollection(from);
    }

    else if (listReply === "women") {
      await sendWomenCollection(from);
    }

    else if (listReply === "kids") {
      await sendKidsCollection(from);
    }

    else if (buttonReply === "shirt" || buttonReply === "floral" || buttonReply === "kidswear") {
      userState[from].item = buttonReply;
      await askSize(from);
    }

    else if (buttonReply === "S" || buttonReply === "M" || buttonReply === "L") {
      userState[from].size = buttonReply;
      addToCart(from);
      await showCart(from);
    }

    else if (buttonReply === "view_more_women") {
      await sendWomenCollection(from);
    }

    else if (buttonReply === "view_more_men") {
      await sendMenCollection(from);
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
        text: "👗 *StyleHub*\n\n✨ Trendy Fashion\n🔥 Best Prices\n\nStart shopping now!"
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
      body: { text: "Choose a category 👇" },
      action: {
        button: "View",
        sections: [
          {
            title: "Collections",
            rows: [
              { id: "men", title: "👔 Men" },
              { id: "women", title: "👗 Women" },
              { id: "kids", title: "🧒 Kids" }
            ]
          }
        ]
      }
    }
  });
}

// 👗 Women
async function sendWomenCollection(to) {
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: {
      link: "https://images.unsplash.com/photo-1520975922284-9e0ce8270d0b"
    },
    caption: "🌸 Floral Dress\n💰 ₹999"
  });

  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Select 👇" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "floral", title: "Buy Floral" } },
          { type: "reply", reply: { id: "view_more_women", title: "View More" } }
        ]
      }
    }
  });
}

// 👔 Men
async function sendMenCollection(to) {
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: {
      link: "https://images.unsplash.com/photo-1520975698519-59f7c8d9b5d3"
    },
    caption: "👔 Shirt\n💰 ₹799"
  });

  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Select 👇" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "shirt", title: "Buy Shirt" } },
          { type: "reply", reply: { id: "view_more_men", title: "View More" } }
        ]
      }
    }
  });
}

// 🧒 Kids
async function sendKidsCollection(to) {
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: {
      link: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9"
    },
    caption: "🧒 Kids Wear\n💰 ₹599"
  });

  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Select 👇" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "kidswear", title: "Buy Now" } }
        ]
      }
    }
  });
}

// 📏 Size
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

// 🛒 Add to cart
function addToCart(user) {
  const { item, size } = userState[user];
  userState[user].cart.push({ item, size });
}

// 🛒 Show cart
async function showCart(to) {
  const cart = userState[to].cart;

  let text = "🛒 *Your Cart*\n\n";
  cart.forEach((c) => {
    text += `✨ ${c.item.toUpperCase()} (Size: ${c.size})\n`;
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
          { type: "reply", reply: { id: "add_more", title: "Continue" } },
          { type: "reply", reply: { id: "checkout", title: "Checkout" } }
        ]
      }
    }
  });
}

// 📍 Address
async function askAddress(to) {
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    text: { body: "📍 Enter your address:" }
  });
}

// ✅ Confirm
async function confirmOrder(to) {
  const user = userState[to];

  let text = "✅ Order Confirmed!\n\n";

  user.cart.forEach((c) => {
    text += `✨ ${c.item} (Size: ${c.size})\n`;
  });

  text += `\n📍 ${user.address}\n\nThank you ❤️`;

  await sendMessage({
    messaging_product: "whatsapp",
    to,
    text: { body: text }
  });

  userState[to] = { step: "start", cart: [] };
}

// ===================== START =====================
app.listen(PORT, () => {
  console.log("🚀 Server running");
});