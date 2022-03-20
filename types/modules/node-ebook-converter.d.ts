interface ConversionOptions {
  delete: boolean;
  input: string;
  output: string;
  silent: boolean;
}

interface ConvertArgs {
  author?: string;
  input: string;
  output: string;
}

declare module 'node-ebook-converter' {
  function convert(args: ConvertArgs): Promise<string>;

  export { convert };
}
