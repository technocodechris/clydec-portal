import { verifyUser, getAccessToken, FOLDER_ACCESS } from "./_driveClient.js";

export default async function handler(req, res) {
  try {
    const user = await verifyUser(req);
    const { folderKey } = req.query;
    const allowed = FOLDER_ACCESS[folderKey];
    if (!allowed || !allowed.includes(user.role)) return res.status(403).json({ error: "Not allowed" });

    // Short-lived (~1hr) token, scoped to your connected Drive. The browser
    // uses it to fetch the file directly from Google, so multi-GB files
    // stream straight to disk instead of buffering through our function.
    const accessToken = await getAccessToken();
    res.status(200).json({ accessToken });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
