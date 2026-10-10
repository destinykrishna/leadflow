import * as React from 'react';
import { Globe } from 'lucide-react';
import { changeLanguage, getCurrentLanguage, type SupportedLanguage } from '@/i18n';
import { cn } from '@/lib/utils';

interface LanguageToggleProps {
  className?: string;
  variant?: 'compact' | 'segmented';
}

export function LanguageToggle({ className, variant = 'compact' }: LanguageToggleProps) {
  const [currentLang, setCurrentLang] = React.useState<SupportedLanguage>(getCurrentLanguage());

  React.useEffect(() => {
    const handleLanguageChange = () => {
      setCurrentLang(getCurrentLanguage());
    };

    window.addEventListener('leadflow_language_changed', handleLanguageChange);
    return () => {
      window.removeEventListener('leadflow_language_changed', handleLanguageChange);
    };
  }, []);

  const handleToggle = (lang: SupportedLanguage) => {
    changeLanguage(lang);
    setCurrentLang(lang);
  };

  if (variant === 'segmented') {
    return (
      <div
        className={cn(
          'inline-flex items-center rounded-lg border border-border bg-slate-100/80 p-0.5 text-xs',
          className
        )}
        role="group"
        aria-label="Language selection"
      >
        <button
          type="button"
          onClick={() => handleToggle('en')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold transition-all cursor-pointer',
            currentLang === 'en'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900'
          )}
          aria-pressed={currentLang === 'en'}
        >
          <span>EN</span>
          <span className="text-[10px] font-normal text-muted-foreground hidden sm:inline">
            English
          </span>
        </button>
        <button
          type="button"
          onClick={() => handleToggle('de')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold transition-all cursor-pointer',
            currentLang === 'de'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-500 hover:text-slate-900'
          )}
          aria-pressed={currentLang === 'de'}
        >
          <span>DE</span>
          <span className="text-[10px] font-normal text-muted-foreground hidden sm:inline">
            Deutsch
          </span>
        </button>
      </div>
    );
  }

  // Compact header toggle
  return (
    <div
      className={cn(
        'flex items-center rounded-md border border-border/80 bg-slate-50/70 p-0.5 text-xs select-none',
        className
      )}
      role="group"
      aria-label="Language toggle"
    >
      <Globe className="h-3.5 w-3.5 text-slate-400 ml-1.5 mr-0.5" aria-hidden="true" />
      <button
        type="button"
        onClick={() => handleToggle('en')}
        className={cn(
          'rounded px-1.5 py-0.5 font-medium text-[11px] transition-colors cursor-pointer',
          currentLang === 'en'
            ? 'bg-white text-slate-900 font-bold shadow-2xs'
            : 'text-slate-500 hover:text-slate-900'
        )}
        title="Switch to English"
        aria-label="Switch to English"
        aria-pressed={currentLang === 'en'}
      >
        EN
      </button>
      <span className="text-slate-300 text-[10px]" aria-hidden="true">
        /
      </span>
      <button
        type="button"
        onClick={() => handleToggle('de')}
        className={cn(
          'rounded px-1.5 py-0.5 font-medium text-[11px] transition-colors cursor-pointer',
          currentLang === 'de'
            ? 'bg-white text-slate-900 font-bold shadow-2xs'
            : 'text-slate-500 hover:text-slate-900'
        )}
        title="Zu Deutsch wechseln"
        aria-label="Zu Deutsch wechseln"
        aria-pressed={currentLang === 'de'}
      >
        DE
      </button>
    </div>
  );
}
