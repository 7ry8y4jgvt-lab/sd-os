import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@200;300;400;500&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=DM+Sans:wght@300;400;500&family=Space+Mono:wght@400&display=swap" rel="stylesheet" />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'DM Sans', sans-serif; background: #FFFFFF; color: #0D0D0B; }
          button {
            font-family: 'DM Sans', sans-serif;
            font-size: 13px;
            padding: 7px 14px;
            border-radius: 4px;
            border: 0.5px solid #D4D1CB;
            background: #FFFFFF;
            color: #0D0D0B;
            cursor: pointer;
            transition: background 0.15s;
          }
          button:hover:not(:disabled) { background: #F7F6F3; }
          button:disabled { opacity: 0.5; cursor: not-allowed; }
          select, input, textarea {
            font-family: 'DM Sans', sans-serif;
            outline: none;
          }
          select:focus, input:focus, textarea:focus {
            border-color: #C41E2D !important;
          }
          ::selection { background: #C41E2D; color: #FFFFFF; }
        `}</style>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
