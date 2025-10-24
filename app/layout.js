import './globals.css';

export const metadata = {
  title: 'Auto Editor Upload Console',
  description: 'Stage your project archive in the cloud and start editing faster.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
