import { Button } from './Button';

export const describe = 'Button';

it('renders the label', () => {
  const result = <Button label="Click me" />;
  expect(result).toBeTruthy();
});
