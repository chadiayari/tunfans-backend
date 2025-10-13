# Frontend Dependencies for Socket.IO Chat

To implement the chat functionality in your React frontend, you'll need to install these dependencies:

```bash
# Core dependencies
npm install socket.io-client axios

# Optional dependencies for enhanced functionality
npm install react-router-dom  # If you need routing
npm install react-toastify    # For notifications
npm install moment           # For better time formatting
```

## Environment Variables

Create a `.env` file in your React app root:

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SERVER_URL=http://localhost:5000
```

## Usage in your React App

```jsx
// App.js
import React from 'react';
import ChatComponent from './components/ChatComponent';
import useSocket from './hooks/useSocket';
import './components/ChatComponent.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Fetch current user info
    if (token) {
      fetchCurrentUser();
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get('/api/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentUser(response.data.user);
    } catch (error) {
      console.error('Auth error:', error);
      localStorage.removeItem('token');
      setToken(null);
    }
  };

  if (!token || !currentUser) {
    return <LoginComponent onLogin={setToken} />;
  }

  return (
    <div className="App">
      <ChatComponent token={token} currentUser={currentUser} />
    </div>
  );
}

export default App;
```

## Key Features Included:

1. **Real-time messaging** with Socket.IO
2. **User authentication** with JWT tokens
3. **Online/offline status** indicators
4. **Typing indicators**
5. **Message read receipts**
6. **Conversation management**
7. **Responsive design**
8. **Message notifications**
9. **Automatic reconnection**
10. **Error handling**