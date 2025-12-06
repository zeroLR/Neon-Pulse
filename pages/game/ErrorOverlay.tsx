import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorOverlayProps {
  message: string;
}

const ErrorOverlay: React.FC<ErrorOverlayProps> = ({ message }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black text-white z-50">
      <div className="text-center text-red-500">
        <AlertTriangle size={48} className="mx-auto mb-4" />
        <p>{message}</p>
      </div>
    </div>
  );
};

export default ErrorOverlay;
