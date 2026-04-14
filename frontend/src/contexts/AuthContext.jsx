import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Configure axios defaults
  axios.defaults.baseURL = 'http://localhost:8000/api';
  axios.defaults.withCredentials = true;

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Token ${token}`;
      // Verify token by getting user profile
      axios.get('/accounts/profile/')
        .then(response => {
          setUser(response.data);
        })
        .catch(error => {
          console.error('Token verification failed:', error);
          // Don't call logout here to avoid infinite loop
          setUser(null);
          setToken(null);
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (username, password, options = {}) => {
    try {
      const response = await axios.post('/accounts/login/', {
        username,
        password,
        parent_login: options.parentLogin || false,
      });
      
      const { user: userData, token: userToken } = response.data;
      setUser(userData);
      setToken(userToken);
      localStorage.setItem('token', userToken);
      axios.defaults.headers.common['Authorization'] = `Token ${userToken}`;
      
      return { success: true, user: userData };
    } catch (error) {
      console.error('Login failed:', error);
      const data = error.response?.data;
      let message = data?.message || data?.detail;
      if (!message && data?.non_field_errors) {
        message = Array.isArray(data.non_field_errors)
          ? data.non_field_errors.join(' ')
          : data.non_field_errors;
      }
      if (!message && typeof data === 'string') {
        message = data;
      }
      return {
        success: false,
        error: message || 'Login failed'
      };
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await axios.post('/accounts/logout/');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isStudent: user?.role === 'student',
    isTeacher: user?.role === 'teacher',
    isParent: user?.role === 'parent',
    isLibrarian: user?.role === 'librarian',
    isHostelWarden: user?.role === 'hostel_warden',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
