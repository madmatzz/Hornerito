import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

console.log('API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Add timeout and validation
  timeout: 10000,
  validateStatus: (status) => status >= 200 && status < 500,
});

export const getExpenses = async () => {
  try {
    console.log('Fetching expenses from:', `${API_BASE_URL}/api/expenses`);
    const response = await api.get('/api/expenses');
    console.log('Expenses response:', response.status, response.statusText);
    return response.data;
  } catch (error) {
    console.error('Error fetching expenses:', error);
    if (axios.isAxiosError(error)) {
      console.error('Axios error details:', {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
      });
    }
    throw error;
  }
};

export const getRecentExpenses = async () => {
  try {
    console.log('Fetching recent expenses from:', `${API_BASE_URL}/api/recent-expenses`);
    const response = await api.get('/api/recent-expenses');
    console.log('Recent expenses response:', response.status, response.statusText);
    return response.data;
  } catch (error) {
    console.error('Error fetching recent expenses:', error);
    if (axios.isAxiosError(error)) {
      console.error('Axios error details:', {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
      });
    }
    throw error;
  }
};

export const getRecurringExpenses = async () => {
  try {
    console.log('Fetching recurring expenses from:', `${API_BASE_URL}/api/recurring-expenses`);
    const response = await api.get('/api/recurring-expenses');
    console.log('Recurring expenses response:', response.status, response.statusText);
    return response.data;
  } catch (error) {
    console.error('Error fetching recurring expenses:', error);
    if (axios.isAxiosError(error)) {
      console.error('Axios error details:', {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
      });
    }
    throw error;
  }
};

export default api; 