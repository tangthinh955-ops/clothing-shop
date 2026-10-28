interface TransformInput { value: unknown }

export const trim = ({ value }: TransformInput): unknown =>
  typeof value === 'string' ? value.normalize('NFC').trim() : value;

export const lower = ({ value }: TransformInput): unknown =>
  typeof value === 'string' ? value.normalize('NFC').trim().toLowerCase() : value;
