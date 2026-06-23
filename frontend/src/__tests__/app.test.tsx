import { render, screen } from '@testing-library/react';

function App() {
  return <h1>YourHonor AI</h1>;
}

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText('YourHonor AI')).toBeInTheDocument();
  });
});
