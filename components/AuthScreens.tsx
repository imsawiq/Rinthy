import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, Globe, Key, Loader2, ShieldCheck } from 'lucide-react';
import { LanguageSelect, useSettings } from '../contexts/SettingsContext';
import ModrinthLogo from './ModrinthLogo';

const AuthLogoMark: React.FC<{ pulse?: boolean }> = ({ pulse = false }) => (
  <div className={`mb-10 flex h-32 w-32 items-center justify-center ${pulse ? 'animate-pulse-slow' : ''}`}>
    <ModrinthLogo className="h-24 w-24 object-contain" />
  </div>
);

export const WelcomeSetup: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { t, language, setLanguage } = useSettings();
  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-modrinth-bg text-center animate-fade-in">
      <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center px-6 py-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <div className="flex flex-1 flex-col items-center justify-center py-6">
        <AuthLogoMark />

        <h2 className="text-3xl font-bold text-modrinth-text mb-3 animate-fade-in-up">{t('welcome_title')}</h2>
        <p className="text-modrinth-muted mb-10 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>{t('welcome_subtitle')}</p>

        <div className="app-panel w-full p-4 overflow-visible">
          <div className="text-modrinth-green font-bold text-sm uppercase mb-3">{t('choose_language')}</div>
          <LanguageSelect value={language} onChange={setLanguage} />
        </div>
      </div>

      <button
        type="button"
        onClick={onComplete}
        className="sticky bottom-0 z-10 w-full bg-modrinth-green text-white font-bold py-4 rounded-lg active:scale-[0.98] flex items-center justify-center gap-2"
      >
        {t('continue')} <ChevronRight size={20} />
      </button>
      </div>
    </div>
  );
};

export const Onboarding: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const { t } = useSettings();
  const steps = [
    {
      icon: <ModrinthLogo className="w-16 h-16 text-modrinth-green" />,
      title: t('onboarding_title'),
      desc: t('onboarding_desc')
    },
    {
      icon: <ShieldCheck size={56} className="text-modrinth-green" />,
      title: t('onboarding_secure_title'),
      desc: t('onboarding_secure_desc')
    },
    {
      icon: <Key size={56} className="text-modrinth-green" />,
      title: t('onboarding_access_title'),
      desc: t('onboarding_access_desc')
    }
  ];

  return (
    <div className="fixed inset-0 z-[200] bg-modrinth-bg flex flex-col items-center justify-center p-6 text-center animate-fade-in">
      <div className="w-full max-w-sm flex-1 flex flex-col items-center justify-center">
        {step === 0 ? <AuthLogoMark pulse /> : (
          <div className="mb-10 flex h-32 w-32 items-center justify-center animate-pulse-slow">
            {steps[step].icon}
          </div>
        )}
        <h2 className="text-3xl font-bold text-modrinth-text mb-4 animate-fade-in-up">{steps[step].title}</h2>
        <p className="text-modrinth-muted mb-10 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>{steps[step].desc}</p>
        <div className="flex gap-3 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`h-2 rounded-full transition-all duration-500 ${i === step ? 'w-10 bg-modrinth-green' : 'w-2 bg-zinc-700'}`} />
          ))}
        </div>
      </div>
      <button onClick={() => step < steps.length - 1 ? setStep(step + 1) : onComplete()} className="w-full max-w-sm bg-modrinth-green text-white font-bold py-4 rounded-lg active:scale-[0.98] flex items-center justify-center gap-2">
        {step === steps.length - 1 ? t('start') : t('next')} <ChevronRight size={20} />
      </button>
    </div>
  );
};

export const LoginScreen: React.FC<{ onLogin: (token: string) => void; onStartOAuth: () => void; isLoading: boolean; error: string | null; onShowHelp: () => void; savedToken?: string | null }> = ({ onLogin, onStartOAuth, isLoading, error, onShowHelp, savedToken }) => {
  const [tokenInput, setTokenInput] = useState(savedToken || '');
  const [showPatLogin, setShowPatLogin] = useState(false);

  useEffect(() => {
    if (!tokenInput && savedToken) {
      setTokenInput(savedToken);
    }
  }, [savedToken, tokenInput]);

  const { t } = useSettings();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-modrinth-bg p-6 relative overflow-hidden">
      <div className="w-full max-w-xs animate-fade-in-up relative z-10">
        <div className="flex justify-center mb-8">
           <div className="flex h-28 w-28 items-center justify-center">
              <ModrinthLogo className="h-20 w-20 object-contain" />
           </div>
        </div>
        <h1 className="text-3xl font-bold text-center text-modrinth-text mb-2">{t('login_title')}</h1>
        <p className="text-modrinth-muted text-center text-sm mb-8">{t('login_subtitle')}</p>
        <div className="space-y-4">
          {error && <div className="text-red-400 text-sm text-center bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</div>}
          <button onClick={onStartOAuth} disabled={isLoading} className="w-full bg-modrinth-green text-white font-bold py-4 rounded-lg active:scale-[0.98] flex items-center justify-center gap-2">
            {isLoading ? <Loader2 className="animate-spin" /> : <Globe size={18} />}
            {isLoading ? t('oauth_loading') : t('oauth_continue')}
          </button>
          <button
            onClick={() => setShowPatLogin(prev => !prev)}
            className="w-full text-xs text-center text-modrinth-muted hover:text-modrinth-green underline decoration-dotted"
          >
            {showPatLogin ? t('hide_pat') : t('use_pat_instead')}
          </button>
          {showPatLogin && (
            <div className="space-y-3 pt-2">
              <div className="app-panel p-1">
                <input type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="mrp_..." className="w-full bg-transparent text-modrinth-text p-4 outline-none text-center font-mono" />
              </div>
              <button onClick={() => onLogin(tokenInput)} disabled={isLoading || !tokenInput} className="w-full bg-modrinth-card text-modrinth-text font-bold py-4 rounded-lg active:scale-[0.98] flex items-center justify-center border border-modrinth-border">
                {isLoading ? <Loader2 className="animate-spin" /> : t('authorize')}
              </button>
              <button onClick={onShowHelp} className="w-full text-xs text-center text-modrinth-muted hover:text-modrinth-green underline decoration-dotted">{t('how_to_get_token')}</button>
            </div>
          )}
        </div>
      </div>
      <div className="absolute bottom-6 text-[10px] text-modrinth-muted text-center w-full">
        Unofficial app for Modrinth. Not affiliated with or endorsed by Modrinth. by <a href="https://modrinth.com/user/imsawiq" className="font-bold text-modrinth-green">imsawiq</a>
      </div>
    </div>
  );
};

export const TokenHelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useSettings();
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(onClose, 180);
  };

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  return (
    <div data-closing={closing ? 'true' : undefined} className="app-overlay fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end justify-center p-4 sm:items-center sm:p-6" onClick={requestClose}>
      <div className="app-responsive-sheet bg-modrinth-card p-6 max-w-md w-full border border-modrinth-border" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-modrinth-text mb-4">{t('token_help_title')}</h3>
        <ol className="list-decimal list-inside space-y-2 text-modrinth-muted text-sm mb-6">
          <li>{t('token_help_open')} <a className="text-modrinth-green hover:underline font-bold" href="https://modrinth.com/settings/pats" target="_blank" rel="noopener noreferrer">https://modrinth.com/settings/pats</a></li>
          <li>{t('token_help_create')}</li>
          <li>{t('token_help_scopes')}</li>
          <li>{t('token_help_paste')}</li>
          <li>{t('token_help_local')}</li>
        </ol>
        <button onClick={requestClose} className="w-full bg-modrinth-green text-white font-bold py-3 rounded-lg">{t('got_it')}</button>
      </div>
    </div>
  );
};
