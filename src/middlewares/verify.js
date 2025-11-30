import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"];
  // check token
  if (token && token !== "Bearer null") {
    const accessToken = token.split(" ")[1];
    // if token exist => verify
    jwt.verify(accessToken, process.env.JWT_ACCESSTOKEN_KEY, (err, user) => {
      if (err) {
        return res
          .status(401)
          .json({ success: false, message: "Token is invalid" });
      }
      req.user = user;
      next();
    });
  } else {
    return res
      .status(401)
      .json({ success: false, message: "You're not authenticated" });
  }
};
export const verifyUser = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user._id === req.params.id || req.user.role === "admin") {
      next();
    } else {
      return res
        .status(403)
        .json({ success: false, message: "You're not authenticated" });
    }
  });
};
export const verifyAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role === "admin") {
      next();
    } else {
      return res
        .status(403)
        .json({ success: false, message: "You're not authenticated" });
    }
  });
};
