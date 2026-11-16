// Where the frontend finds the backend.
//
// 1) Opened from the backend itself (http://localhost:3000 after "npm start"): nothing to change.
// 2) Opened from GitHub Pages (https://yourname.github.io/...): GitHub Pages cannot run a backend,
//    so put the address of your deployed backend below, e.g. 'https://zakattrack-api.onrender.com'
//    (no slash at the end), and add your GitHub Pages address to ALLOWED_ORIGINS in server/.env.
window.ZT_CONFIG = {
  BACKEND_FOR_GITHUB_PAGES: ''
};
