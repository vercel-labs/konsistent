interface InputProps {
  name: string;
  placeholder?: string;
}

export function Input({ name, placeholder }: InputProps) {
  return <input name={name} placeholder={placeholder} />;
}
