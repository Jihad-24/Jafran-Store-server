const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5001;

// middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8urwnno.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const productCollection = client.db("JafranStore").collection("products");
    const bannerCollection = client.db("JafranStore").collection("banners");
    const cartCollection = client.db("JafranStore").collection("cart");
    const userCollection = client.db("JafranStore").collection("users");
    const orderCollection = client.db("JafranStore").collection("orders");

    // prduct related apis

    app.get("/products", async (req, res) => {
      const cursor = productCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/cart", async (req, res) => {
      const email = req.query.email;

      const result = await cartCollection.find({ userEmail: email }).toArray();

      res.send(result);
    });

    app.get("/cart/:id", async (req, res) => {
      const id = req.params.id;
      const quary = { _id: new ObjectId(id) };
      const result = await cartCollection.findOne(quary);
      res.send(result);
    });

    app.get("/banners", async (req, res) => {
      const cursor = bannerCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/items/:id", async (req, res) => {
      const id = req.params.id;
      const quary = { _id: new ObjectId(id) };
      const result = await productCollection.findOne(quary);
      res.send(result);
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.query.email;

      if (!email) {
        return res.status(403).send({ message: "Forbidden" });
      }

      const user = await userCollection.findOne({ email });

      if (user?.role !== "admin") {
        return res.status(403).send({ message: "Admin only" });
      }

      next();
    };

    app.get("/orders", verifyAdmin, async (req, res) => {
      try {
        const orders = await orderCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();

        res.send({
          success: true,
          total: orders.length,
          data: orders,
        });
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch orders" });
      }
    });

    app.patch("/orders/:id", verifyAdmin, async (req, res) => {
      try {
        const orderId = req.params.id;
        const { status, payment } = req.body;

        const update = {
          updatedAt: new Date(),
        };

        if (status) update.status = status;
        if (payment) update.payment = payment;

        const result = await orderCollection.updateOne(
          { id: orderId },
          { $set: update },
        );

        res.send({
          success: true,
          message: "Order updated successfully",
          result,
        });
      } catch (err) {
        res.status(500).send({ message: "Failed to update order" });
      }
    });

    app.delete("/orders/:id", verifyAdmin, async (req, res) => {
      try {
        const orderId = req.params.id;

        const result = await orderCollection.deleteOne({ id: orderId });

        res.send({
          success: true,
          message: "Order deleted successfully",
          result,
        });
      } catch (err) {
        res.status(500).send({ message: "Failed to delete order" });
      }
    });

    app.get("/orders/user", async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({
            success: false,
            message: "Email is required",
          });
        }

        const orders = await orderCollection
          .find({ "customer.email": email })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(orders);
      } catch (err) {
        console.error("User orders error:", err);
        res.status(500).send({
          success: false,
          message: "Failed to fetch user orders",
        });
      }
    });

    app.post("/cart/merge", async (req, res) => {
      const { email, items } = req.body;

      if (!email || !items) {
        return res.status(400).send({ message: "Missing data" });
      }

      try {
        const userCart = await cartCollection
          .find({ userEmail: email })
          .toArray();

        for (let item of items) {
          const existing = userCart.find((i) => i.productId === item.productId);

          if (existing) {
            await cartCollection.updateOne(
              { _id: existing._id },
              { $inc: { qty: item.qty } },
            );
          } else {
            await cartCollection.insertOne({
              ...item,
              userEmail: email,
            });
          }
        }

        res.send({ success: true, message: "Cart merged" });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Merge failed" });
      }
    });

    app.post("/cart", async (req, res) => {
      try {
        const item = req.body;

        const query = {
          userEmail: item.userEmail,
          productId: item.productId,
        };

        const existing = await cartCollection.findOne(query);

        if (existing) {
          // update quantity
          const result = await cartCollection.updateOne(query, {
            $inc: { qty: item.qty },
          });
          return res.send(result);
        }

        const result = await cartCollection.insertOne(item);
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send("Error adding to cart");
      }
    });

    app.patch("/cart/:id", async (req, res) => {
      const id = req.params.id;
      const { qty } = req.body;

      const result = await cartCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { qty } },
      );

      res.send(result);
    });

    // app.patch("/cart/:id", async (req, res) => {
    //   try {
    //     const id = req.params.id;
    //     const { qty, selectedSize, selectedColor } = req.body;

    //     const updateFields = {};

    //     if (qty !== undefined) updateFields.qty = qty;
    //     if (selectedSize !== undefined)
    //       updateFields.selectedSize = selectedSize;
    //     if (selectedColor !== undefined)
    //       updateFields.selectedColor = selectedColor;

    //     const result = await cartCollection.updateOne(
    //       { _id: new ObjectId(id) },
    //       { $set: updateFields },
    //     );

    //     res.send(result);
    //   } catch (err) {
    //     console.error(err);
    //     res.status(500).send({ success: false, message: "Cart update failed" });
    //   }
    // });

    app.post("/products", async (req, res) => {
      try {
        const product = req.body;

        // normalize images
        if (!product.images || !Array.isArray(product.images)) {
          product.images = [];
        }

        product.createdAt = new Date();

        const result = await productCollection.insertOne(product);

        res.send({
          success: true,
          data: result,
        });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    app.patch("/products/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const { _id, id: ignoreId, ...safeData } = req.body;

        if (safeData.images && !Array.isArray(safeData.images)) {
          safeData.images = [safeData.images];
        }

        const result = await productCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              ...safeData,
              updatedAt: new Date(),
            },
          },
        );

        res.send({
          success: true,
          data: result,
        });
      } catch (err) {
        console.error(err); // 👈 important for debugging
        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    app.post("/banners", verifyAdmin, async (req, res) => {
      try {
        const newBanner = {
          ...req.body,
          createdAt: new Date(),
        };

        const result = await bannerCollection.insertOne(newBanner);

        res.send({
          success: true,
          message: "Banner created successfully",
          result,
        });
      } catch (err) {
        res.status(500).send({ message: "Failed to create banner" });
      }
    });
    app.delete("/banners/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bannerCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/orders", async (req, res) => {
      try {
        const order = req.body;

        // ✅ validation
        if (!order.customer?.email || !order.items?.length) {
          return res.status(400).send({
            success: false,
            message: "Invalid order data",
          });
        }

        const newOrder = {
          ...order,
          status: "pending", // important for admin tracking
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await orderCollection.insertOne(newOrder);

        res.send({
          success: true,
          orderId: result.insertedId,
        });
      } catch (err) {
        console.error("Order error:", err);
        res.status(500).send({
          success: false,
          message: "Failed to create order",
        });
      }
    });

    // app.put("/product/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const filter = { _id: new ObjectId(id) };
    //   const options = { upsert: true };
    //   const updatedProduct = req.body;
    //   const product = {
    //     $set: {
    //       name: updatedProduct.name,
    //       price: updatedProduct.price,
    //       brand: updatedProduct.brand,
    //       type: updatedProduct.type,
    //       rating: updatedProduct.rating,
    //       details: updatedProduct.details,
    //       photo: updatedProduct.photo,
    //     },
    //   };
    //   const result = await productCollection.updateOne(
    //     filter,
    //     product,
    //     options,
    //   );
    //   res.send(result);
    // });

    app.delete("/products/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await productCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send({
          success: true,
          data: result,
        });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // app.delete("/cart/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const quary = { _id: new ObjectId(id) };
    //   const result = await cartCollection.deleteOne(quary);
    //   res.send(result);
    // });
    app.delete("/cart/:id", async (req, res) => {
      const id = req.params.id;

      const result = await cartCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    app.delete("/cart", async (req, res) => {
      const email = req.query.email;

      const result = await cartCollection.deleteMany({
        userEmail: email,
      });

      res.send(result);
    });

    // user related apis

    app.get("/allusers", async (req, res) => {
      const email = req.query.email;

      if (email) {
        const user = await userCollection.find({ email }).toArray();
        return res.send(user);
      }

      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.get("/admin/users", verifyAdmin, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.patch("/admin/users/:email", verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const { role, status } = req.body;

      const update = {};

      if (role) update.role = role;
      if (status) update.status = status;

      const result = await userCollection.updateOne(
        { email },
        { $set: update },
      );

      res.send(result);
    });

    app.delete("/admin/users/:email", verifyAdmin, async (req, res) => {
      const email = req.params.email;

      const result = await userCollection.deleteOne({ email });

      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const email = req.query.email;

      if (email) {
        const user = await userCollection.findOne({ email });
        return res.send(user || null);
      }

      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.patch("/users/avatar", async (req, res) => {
      const { email, photoURL } = req.body;

      if (!email || !photoURL) {
        return res.status(400).send({ message: "Missing data" });
      }

      const result = await userCollection.updateOne(
        { email },
        { $set: { photoURL, updatedAt: new Date() } },
      );

      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;

      if (!user.email) {
        return res.status(400).send({ message: "Email required" });
      }

      const filter = { email: user.email };

      const updateDoc = {
        $set: {
          photoURL: user.photoURL || "",
          name: user.name || "",
          provider: user.provider || "email",
          lastLogin: new Date(),
        },
        $setOnInsert: {
          email: user.email,
          role: "user",
          createdAt: new Date(),
        },
      };

      const options = { upsert: true };

      const result = await userCollection.updateOne(filter, updateDoc, options);

      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("my jafran store server is running...");
});

app.listen(port, () => {
  console.log(`jafran store is Running on port ${port}`);
});
