export const metadata = {
  title: "곁",
  description: "반려AI · 곁"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
