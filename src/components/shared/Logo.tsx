import Link from 'next/link';

interface LogoProps {
  href?: string;
  className?: string;
  showText?: boolean;
}

export default function Logo({ href = '/', className = '', showText = true }: LogoProps) {
  return (
    <Link href={href} className={`flex items-center space-x-2 group ${className}`}>
      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center transform group-hover:scale-110 transition-transform duration-200">
        <span className="text-white font-bold text-lg">🧠</span>
      </div>
      {showText && (
        <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          CodeMind
        </span>
      )}
    </Link>
  );
}
