const User = require("../Database/models/User");
const bcrypt = require("bcryptjs");
const express = require("express");
const Logger = require("../../utils/logging/Logger");

const app = express.Router();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.post("/auth/v1/register", async (req, res) => {
    const { email, username, password: text, discriminator } = req.body;

    if (!username || typeof username !== "string") {
        return res.json({ error: "Invalid Username, Please enter the valid username." });
    } else if (!text || typeof text !== "string") {
        return res.json({ error: "Invalid Password, Please enter the valid password." });
    } else if (text.length < 5) {
        return res.json({
            error: "Password too short. your password shhould be atleast 6 characters"
        })
    }
    const password = await bcrypt.hash(text, 10)

    try {
        const user = await new User({
            email,
            password,
            username
        });

        user.save().then(() => {
            res.redirect("/auth/v1/login");
            Logger.INFO("Successfully created Account.");
        }).catch(err => Logger.ERROR(err));
    } catch (err) {
        if (err.code === 11000) {
            return res.json({ error: "Username is taken." })
        }
        throw Logger.ERROR(err);
    }

    res.json({ message: "successful" })
});
module.exports = app;