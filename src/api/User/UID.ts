// Public API

import express, { Router } from "express";
import User from "../../Database/models/User";
import Logger from "../../utils/Logger";
import { Error, ERR_NOTFOUND } from "../Errors/Errors";
import { API_BASE } from "../../config/config.json";

const app = Router();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.post(`${API_BASE}user/:userID`, async (req, res) => {
  const UID: Number = parseInt(req.params.userID);
  let userRequest;

  try {
    userRequest = await User.findOne({ UID });
  } catch (error) {
    return res.sendStatus(400);
  }
  const user = userRequest;

  try {
    if (!user || !UID) {
      return res.status(404).json(Error(ERR_NOTFOUND));
    }
    return res.json({
      avatar: user.avatar,
      username: user.username,
      ID: user.UID, // User IDs should be in UNIX time of join date
      about: user.aboutme,
      status: user.status,
    });
  } catch (err) {
    res.sendStatus(400); // Bad request
    Logger.ERROR(err);
  }
});

export = app;
