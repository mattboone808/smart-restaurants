Smart Restaurants — Restaurant Finder Web App

# Description:
Smart Restaurants is a lightweight web application that allows users to search for restaurants by city, cuisine, rating, or price range. Phase I features include the abilities to view restaurants by search and filter criteria and make simple reservations that are saved in a local SQLite database.


# Technologies Used

Languages: JavaScript (Node.js), HTML

Frameworks/Libraries: Express, better-sqlite3, CORS

Database: SQLite

Tools: GitHub Codespaces, Visual Studio Code, Node Package Manager (npm)

# Installation

### Prerequisites
To run this project, you’ll need the following installed on your system:

# 1. Node.js (LTS version)
  Node.js provides the runtime environment for running the backend server.  
  You can check if it's installed by running:
  node -v
  npm -v
If these commands show version numbers, you already have it installed.
If not, install Node.js (which includes npm) as follows:

macOS:
brew install node
or download from https://nodejs.org

Windows:
Download and install from https://nodejs.org

Linux (Ubuntu/Debian):
sudo apt update
sudo apt install -y nodejs npm

# 2. Visual Studio Code (VS Code)
Download from https://code.visualstudio.com/

# 3. Live Server extension for VS Code
In VS Code, press Cmd+Shift+X (Mac) or Ctrl+Shift+X (Windows),
search “Live Server” by Ritwick Dey, and click Install.

# Steps for running the application
1. Open the smart-restaurants folder in Visual Studio Code

2. Navigate to the backend folder
cd smart-restaurants/backend

3. Install backend dependencies
npm install

4. Build and seed the database
npm run seed

5. Start the backend server: 
npm start

6. Open the frontend folder in VS Code
Right-click index.html → “Open with Live Server.”

7. The app should open automatically in your browser
(typically at http://127.0.0.1:5500/frontend/index.html).

8. You are now running the web app and can search for restaurants 
   and create reservations that are stored in the local database

# Features

- Search restaurants by city, cuisine, or price range

- Option to only display Restaurants that are currently open

- Create and store reservations in SQLite

- Rebuild database anytime via npm run seed

- Clear modular structure (backend/ for API, frontend/ for UI)