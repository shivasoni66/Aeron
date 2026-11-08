import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export const DashboardLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Sidebar />
      <div className="pl-72 flex flex-col min-h-screen">
        <Header />
        <main className="w-full pt-16 pb-16 bg-background flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
};

