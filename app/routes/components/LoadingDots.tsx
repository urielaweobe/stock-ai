import { useEffect, useState } from 'react';

export default function LoadingDots() {
  const [dots, setDots] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev % 3) + 1);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-black dark:text-gray-200">
      Thinking{'.'.repeat(dots)}
    </div>
  );
}
