import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hóa Đơn App - Kế toán Hộ Kinh Doanh",
  description: "Ứng dụng kế toán cho hộ kinh doanh cá thể theo mẫu S2a-HKD. Quản lý hàng hóa, xuất hóa đơn, tính thuế GTGT và TNCN.",
  keywords: ["kế toán", "hộ kinh doanh", "hóa đơn", "S2a-HKD", "thuế GTGT", "thuế TNCN"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            className: 'toast-custom',
            style: {
              background: '#fff',
              color: '#0f172a',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            },
          }}
        />
      </body>
    </html>
  );
}
