SUMANGAL GOLD — LOCAL ADMIN PANEL
================================

WHAT THIS ADDS
- Private admin login
- Add, edit and delete product catalogue entries
- Upload a product image into its category folder
- Saves catalogue changes directly to products.json
- Keeps your existing public index.html design and category filters

IMPORTANT: This version is for your VS Code computer. It runs a small local Node.js server. It is not a public hosted admin service and the admin server is deliberately bound to 127.0.0.1. Do not expose it to the internet. A later public admin panel requires secure hosting, HTTPS, server-side authentication, backups and a database or protected file storage.

SETUP (Windows / VS CODE)
1. Install Node.js LTS if it is not already installed: https://nodejs.org/
2. Extract this folder and open it in VS Code.
3. Open Terminal > New Terminal in VS Code.
4. Run: npm install
5. Set a private admin password (at least 12 characters) in PowerShell:
   $env:ADMIN_PASSWORD = "Choose-A-Long-Private-Password"
6. Start the local website and admin server:
   npm start
7. Open the public website: http://127.0.0.1:3000
8. Open the admin panel: http://127.0.0.1:3000/admin.html
9. Sign in using the password you set in step 5.

ADDING PRODUCTS
1. Click + Add product.
2. Enter product name, category, subcategory and price text.
3. Select a product image. The server saves it in image/<category>/.
4. Click Save Product. The item is written to products.json and appears on the public site.
5. Use Edit or Delete beside a product to manage it.

IMAGE RULES
- JPG, PNG, WEBP and GIF are accepted. Maximum upload size: 8 MB per image.
- Category folders are already created under image/.
- Existing image paths and external HTTPS images remain supported.

PUBLISHING CHANGES LATER
The current local admin writes to your computer only. When you finish adding products, upload the updated index.html, products.json and image/ folder to your website hosting. Do NOT upload server.js or expose the local admin server as a public website. If you want to manage products after the website goes live, ask for a hosted admin/backend setup.

TROUBLESHOOTING
- If 'npm' is not recognised, install Node.js LTS, close and reopen VS Code, then try again.
- Keep the terminal running while you use the site. Ctrl+C stops the local server.
- If port 3000 is already in use, run: $env:PORT = "3001" then npm start, and open port 3001 instead.
- The existing site uses fetch('./products.json'), so open it through the local server URL, not by double-clicking index.html.
