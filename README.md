# Khelkud Nepal

A comprehensive sports news application focused on delivering the latest sports updates with location-based content and administrative features.

## Features

- Display latest sports news from various categories
- Admin panel for content management
- User registration and authentication
- Location-based news filtering
- Newsletter subscription
- Responsive design for mobile and desktop viewing

## Technology Stack

- Node.js
- Express.js
- MongoDB
- EJS Templates
- Bootstrap 5
- JavaScript/jQuery

## Prerequisites

- Node.js (v14.x or higher)
- MongoDB (v4.x or higher)
- npm (v6.x or higher)

## Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/khelkud-nepal.git
   cd khelkud-nepal
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/khelkud_nepal
   SESSION_SECRET=your_session_secret
   JWT_SECRET=your_jwt_secret
   ```

4. Start the application
   ```
   npm start
   ```
   
   For development with auto-restart:
   ```
   npm run dev
   ```

5. Access the application at `http://localhost:3000`

## Admin Access

To access the admin panel:

1. Register a user through the application
2. Manually update the user's role to 'admin' in the MongoDB database:
   ```
   db.users.updateOne({email: "admin@example.com"}, {$set: {role: "admin"}})
   ```
3. Access the admin panel at `http://localhost:3000/admin/login`

## Project Structure

```
khelkud-nepal/
├── public/           # Static files (CSS, JS, images)
├── models/           # MongoDB models
├── routes/           # Express routes
├── views/            # EJS templates
│   ├── admin/        # Admin panel views
│   ├── partials/     # Reusable template parts
├── middleware/       # Custom middleware
├── utils/            # Utility functions
├── app.js            # Application entry point
├── package.json      # Project dependencies
└── .env              # Environment variables
```

## License

This project is licensed under the ISC License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Web Scraping with Browserless

This application uses Puppeteer for web scraping news content. You can configure it to use either:

1. **Local Puppeteer** (default): Uses a local Chrome browser instance
2. **Browserless.io** (recommended for production): Uses a cloud-based headless browser service

### Setting up Browserless

1. Sign up for an account at [Browserless.io](https://www.browserless.io/)
2. Get your API key from the dashboard
3. Add it to your `.env` file:

```
BROWSERLESS_API_KEY=your-api-key-here
```

When the API key is present, the application will automatically use Browserless instead of launching a local browser, which improves performance and reliability. 