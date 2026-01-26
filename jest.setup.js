// Jest setup file
// Mock Firebase globals if needed
global.firebase = {
  auth: jest.fn(),
  firestore: jest.fn(),
  storage: jest.fn()
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = localStorageMock;
