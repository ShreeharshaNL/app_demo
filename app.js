require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// 🧠 Simple in-memory state (for testing)
let userState = {};

// ===================== GET (Webhook Verification) =====================
app.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const challenge = req.query['hub.challenge'];
  const token = req.query['hub.verify_token'];

  // 👉 Only for Meta verification
  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log("WEBHOOK VERIFIED");
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }

  // 👉 Normal browser access
  res.send("🚀 WhatsApp Bot is Running");
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

    // Initialize user state
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

    else if (listReply === "fruits") {
      await sendFruits(from);
    }

    else if (buttonReply === "apple") {
      userState[from].item = "Apple";
      await askQuantity(from);
    }

    else if (buttonReply === "banana") {
      userState[from].item = "Banana";
      await askQuantity(from);
    }

    else if (buttonReply === "qty_1") {
      addToCart(from, 1);
      await showCart(from);
    }

    else if (buttonReply === "qty_2") {
      addToCart(from, 2);
      await showCart(from);
    }

    else if (buttonReply === "add_more") {
      await sendCategories(from);
    }

    else if (buttonReply === "checkout") {
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

// ===================== FUNCTIONS =====================

// 🔹 Send message helper
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

// 🔹 Welcome
async function sendWelcome(to) {
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: "👋 Welcome to FreshMart!\n\nWhat would you like to do?"
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: { id: "browse", title: "🛒 Browse Products" }
          }
        ]
      }
    }
  });
}

// 🔹 Categories
async function sendCategories(to) {
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: "🛒 Choose a category:" },
      action: {
        button: "View",
        sections: [
          {
            title: "Categories",
            rows: [
              { id: "fruits", title: "🍎 Fruits" }
            ]
          }
        ]
      }
    }
  });
}

// 🔹 Fruits
async function sendFruits(to) {
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: "🍎 Choose a fruit:"
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: { id: "apple", title: "Apple" }
          },
          {
            type: "reply",
            reply: { id: "banana", title: "Banana" }
          }
        ]
      }
    }
  });
}

// 🔹 Quantity
async function askQuantity(to) {
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: "How many?"
      },
      action: {
        buttons: [
          { type: "reply", reply: { id: "qty_1", title: "1" } },
          { type: "reply", reply: { id: "qty_2", title: "2" } }
        ]
      }
    }
  });
}

// 🔹 Add to cart
function addToCart(user, qty) {
  const item = userState[user].item;
  userState[user].cart.push({ item, qty });
}

// 🔹 Show cart
async function showCart(to) {
  const cart = userState[to].cart;

  let text = "🛒 Your Cart:\n\n";

  cart.forEach((c, i) => {
    text += `${i + 1}. ${c.item} × ${c.qty}\n`;
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
          {
            type: "reply",
            reply: { id: "add_more", title: "➕ Add More" }
          },
          {
            type: "reply",
            reply: { id: "checkout", title: "📍 Add Address" }
          }
        ]
      }
    }
  });
}

// 🔹 Ask address
async function askAddress(to) {
  userState[to].step = "address";

  await sendMessage({
    messaging_product: "whatsapp",
    to,
    text: {
      body: "📍 Enter your delivery address:"
    }
  });
}

// 🔹 Confirm order
async function confirmOrder(to) {
  const user = userState[to];

  let text = "✅ Order Confirmed!\n\n";

  user.cart.forEach((c, i) => {
    text += `${i + 1}. ${c.item} × ${c.qty}\n`;
  });

  text += `\n📍 Address: ${user.address}\n\nThank you ❤️`;

  await sendMessage({
    messaging_product: "whatsapp",
    to,
    text: { body: text }
  });

  // reset user
  userState[to] = { step: "start", cart: [] };
}

// ===================== START SERVER =====================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});