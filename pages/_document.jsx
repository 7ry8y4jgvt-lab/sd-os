import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Jost:wght@300;400;500&display=swap" rel="stylesheet" />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Jost', sans-serif; background: #fafaf9; color: #1a1a1a; }
          button {
            font-family: 'Jost', sans-serif;
            font-size: 13px;
            padding: 7px 14px;
            border-radius: 6px;
            border: 0.5px solid #d1d5db;
            background: #ffffff;
            color: #1a1a1a;
            cursor: pointer;
            transition: background 0.15s;
          }
          button:hover:not(:disabled) { background: #f5f4f1; }
          button:disabled { opacity: 0.5; cursor: not-allowed; }
          select, input, textarea {
            font-family: 'Jost', sans-serif;
            outline: none;
          }
          select:focus, input:focus, textarea:focus {
            border-color: #1a1a1a !important;
          }
        `}</style>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
