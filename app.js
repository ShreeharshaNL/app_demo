require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// 🧠 In-memory user state
let userState = {};

// ===================== GET (Webhook Verification) =====================
app.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const token = req.query["hub.verify_token"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ WEBHOOK VERIFIED");
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }

  res.send("👗 Dress Shop Bot Running");
});

// ===================== POST (Incoming Messages) =====================
app.post("/", async (req, res) => {
  try {
    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;

    const text = message.text?.body?.toLowerCase();
    const buttonReply = message.interactive?.button_reply?.id;
    const listReply = message.interactive?.list_reply?.id;

    console.log("User:", text || buttonReply || listReply);

    // Initialize state
    if (!userState[from]) {
      userState[from] = { step: "start", cart: [] };
    }

    // ===================== FLOW =====================

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

    // PRODUCT SELECTION
    else if (buttonReply === "shirt" || buttonReply === "tshirt" ||
             buttonReply === "floral" || buttonReply === "gown" ||
             buttonReply === "kidswear") {

      userState[from].item = buttonReply;
      await askSize(from);
    }

    // SIZE SELECTION
    else if (buttonReply === "S" || buttonReply === "M" || buttonReply === "L") {
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

    // ADDRESS INPUT
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

// ===================== HELPER =====================
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

// ===================== UI MESSAGES =====================

// 👗 Welcome
async function sendWelcome(to) {
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: "👗 Welcome to StyleHub!\n\n✨ Trendy Fashion\n🔥 Best Prices\n\nWhat would you like to explore?"
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
      body: { text: "🛍️ Choose a category:" },
      action: {
        button: "View Categories",
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

// 👔 Men
async function sendMenCollection(to) {
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: "👔 Men's Collection:\n\n1. Shirt – ₹799\n2. T-Shirt – ₹499"
      },
      action: {
        buttons: [
          { type: "reply", reply: { id: "shirt", title: "Shirt" } },
          { type: "reply", reply: { id: "tshirt", title: "T-Shirt" } }
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
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: "👗 Women's Collection:\n\n1. Floral Dress – ₹999\n2. Party Gown – ₹1999"
      },
      action: {
        buttons: [
          { type: "reply", reply: { id: "floral", title: "Floral Dress" } },
          { type: "reply", reply: { id: "gown", title: "Party Gown" } }
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
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: "🧒 Kids Collection:\n\n1. Kids Wear – ₹599"
      },
      action: {
        buttons: [
          { type: "reply", reply: { id: "kidswear", title: "Kids Wear" } }
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
      body: {
        text: "📏 Select Size:"
      },
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

  let text = "🛒 Your Cart:\n\n";

  cart.forEach((c, i) => {
    text += `${i + 1}. ${c.item} (Size: ${c.size})\n`;
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
          { type: "reply", reply: { id: "add_more", title: "➕ Add More" } },
          { type: "reply", reply: { id: "checkout", title: "📍 Add Address" } }
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
    text: {
      body: "📍 Enter your delivery address:"
    }
  });
}

// ✅ Confirm
async function confirmOrder(to) {
  const user = userState[to];

  let text = "✅ Order Confirmed!\n\n";

  user.cart.forEach((c, i) => {
    text += `${i + 1}. ${c.item} (Size: ${c.size})\n`;
  });

  text += `\n📍 Address: ${user.address}\n\nThank you for shopping ❤️`;

  await sendMessage({
    messaging_product: "whatsapp",
    to,
    text: { body: text }
  });

  userState[to] = { step: "start", cart: [] };
}

// ===================== START =====================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});