import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { HardwareProvider } from '../context/HardwareContext';

export const DashboardLayout: React.FC = () => {
  return (
    <HardwareProvider>
      <div className="min-h-screen bg-background text-text-primary selection:bg-accent-primary selection:text-background flex">
        <Sidebar />
        <div className="pl-72 flex flex-col min-h-screen w-full">
          <Header />
          <main className="w-full pt-16 pb-12 bg-background flex-1 overflow-x-hidden">
            <Outlet />
          </main>
          <Footer />
        </div>
      </div>
    </HardwareProvider>
  );
};
