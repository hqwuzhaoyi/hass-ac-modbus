beforeEach(() => {
  jest.useRealTimers();
});

afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});
