import { Input } from './Input';

export const describe = 'Input';

it('renders with a name', () => {
  const result = <Input name="email" />;
  expect(result).toBeTruthy();
});
