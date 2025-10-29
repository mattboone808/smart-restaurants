# Smart Restaurants – Setup Guide

This guide explains how to set up and run the Smart Restaurants web application locally.  
Follow these steps to get your development environment running correctly.

---

## 1. Prerequisites

Before you begin, make sure you have the following installed on your computer:

- [Node.js](https://nodejs.org/) (version **18** or higher recommended)
- npm (comes bundled with Node.js)
- [Visual Studio Code](https://code.visualstudio.com/) (recommended editor)
- GitHub Desktop or Git command line tools

You can verify Node and npm are installed correctly by running:
```bash
node -v
npm -v
2. Clone the Repository
Clone the project from GitHub to your local machine using one of the following methods.

Option A – GitHub Desktop
Open GitHub Desktop.

Click File → Clone repository…

Enter the repository URL:

bash
Copy code
https://github.com/YOUR-USERNAME/smart-restaurants.git
Choose a local folder where you want to save it.

Click Clone.

Option B – Command Line
bash
Copy code
cd ~/Desktop
git clone https://github.com/YOUR-USERNAME/smart-restaurants.git
cd smart-restaurants
3. Install Dependencies
The project has two main parts: the backend (Node.js + Express) and the frontend (React or HTML/JS).
You must install dependencies in both folders.

Backend
bash
Copy code
cd backend
npm install
Frontend
bash
Copy code
cd ../frontend
npm install
4. Run the Application
You’ll need to run both the backend and frontend servers.

Start the Backend
From inside the backend folder:

bash
Copy code
npm start
By default, it runs at:
➡️ http://localhost:5000

You should see this in your terminal:

arduino
Copy code
✅ API running on http://localhost:5000
Start the Frontend
Open a new terminal, go to the frontend folder, and run:

bash
Copy code
npm run dev
The frontend should start at:
➡️ http://localhost:5173

5. Project Structure
bash
Copy code
smart-restaurants/
├── backend/          # Express.js server, routes, and mock data
├── frontend/         # Web interface (search, filters, reservations)
├── README.md         # Project overview
└── SETUP.md          # Setup instructions (this file)
6. Common Issues & Troubleshooting
Problem	Solution
npm: command not found	Install Node.js from https://nodejs.org
Port 5000 or 5173 already in use	Change the port in backend/server.js or stop the other app using it
CORS error when connecting frontend → backend	Ensure app.use(cors()) is enabled in server.js
“Module not found” or install errors	Run npm install again or delete node_modules and reinstall
Frontend loads but backend data doesn’t appear	Make sure the backend is running and the URLs match (localhost:5000)
Permission denied (Mac/Linux)	Run command with sudo if necessary, or fix folder permissions
Nothing happens when running npm start	Verify you are inside the correct folder (backend/ or frontend/)

7. Team Workflow with GitHub
To stay synced with your teammates:

Pull the latest code before making changes (Fetch origin → Pull origin in GitHub Desktop)

Commit your work with a clear message

Push your changes to GitHub (Push origin)

Create and use branches for separate features (e.g., frontend-ui, backend-api)

Submit a Pull Request when ready to merge into the main branch

8. Environment Notes
If you use Node Version Manager (nvm), you can pin the Node version by creating a .nvmrc file in the root of your repo:

Copy code
18
That ensures everyone uses the same version of Node.

9. Need Help?
If setup issues occur, please:

Check this guide first.

Compare your steps with a teammate who has it working.

If still stuck, contact the project lead for help troubleshooting.

✅ You’re all set!
