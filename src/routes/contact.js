import express from "express";

import {
  addContact,
  responseContact,
  getContacts,
  searchContacts,
  deleteContact,
} from "../app/controllers/ContactController.js";
import { verifyToken } from "../middlewares/verify.js";

const router = express.Router();

router.get("/", verifyToken, getContacts);
router.post("/response", verifyToken, responseContact);
router.post("/add", verifyToken, addContact);
router.post("/search", verifyToken, searchContacts);
router.delete("/delete/:contactId", verifyToken, deleteContact);

export default router;
