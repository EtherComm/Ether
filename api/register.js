const User = require("../Database/models/User");
const bcrypt = require("bcryptjs");
const express = require("express");
const Logger = require("../utils/logging/Logger");
const email__regex =
  /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;
const complexity__regex =
  /^(?:(?=.*[a-z])(?:(?=.*[A-Z])(?=.*[\d\W])|(?=.*\W)(?=.*\d))|(?=.*\W)(?=.*[A-Z])(?=.*\d)).{8,}$/;
const app = express.Router();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/******************** ERROR STRINGS */
const ERR_ENFORCEMENT_FAILED = "Illegal password. Your password should be at least 8 characters in length and follow the enforcement rules of there being AT LEAST\n1. An UPPERCASE character (Such as: ABC)\n2. A LOWERCASE character (Such as: abc)\n3. A NUMBER (Such as: 123)\n4. And a SPECIAL CHARACTER (Such as: !@#)";
const ERR_EMAIL = "Invalid Email, please enter a valid email.";
const ERR_UNAME = "Invalid username, please enter a valid username.";
const ERR_PASWD = "Invalid password, please enter a valid password.";
const ERR_TAKEN = "Username is taken or email is already registered.";
/*********************************** */

app.post("/api/v0/auth/register", async (req, res) => {
  const { email, username, password: text } = req.body;
  if (!email || typeof email !== "string" || !email__regex.test(email)) {
    return res.json({
      error: ERR_EMAIL,
      status: false,
    });
  } else if (!username || typeof username !== "string") {
    return res.json({
      error: ERR_UNAME,
      status: false,
    });
  } else if (!text || typeof text !== "string") {
    return res.json({
      error: ERR_PASWD,
      status: false,
    });
  } else if (text.length < 5 || !complexity__regex.test(text)) {
    return res.json({
      error: ERR_ENFORCEMENT_FAILED,
      status: false,
    });
  }
  const password = await bcrypt.hash(text, 10);

  try {
    const user = await User.create({
      email,
      password,
      username,
    });

    console.log(req.body);

    user.save();
    delete user.password;
    return res.json({ status: true, user });
  } catch (err) {
    if (err.code === 11000) {
      return res.json({ error: ERR_TAKEN, status: false });
    }
    res.sendStatus(500); // Something went wrong
    Logger.ERROR(err);
  }

  res.json({ message: "SUCCESS", status: true });
});
module.exports = app;
