import React, { useState } from 'react';
import {
  ShieldCheck,
  X,
  Lock,
  EyeOff,
  PhoneCall,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
} from 'lucide-react';
import { ThemeMode } from '../types/companion';
import { SENIOR_SECURITY_RESOURCES } from '../utils/security';
import { AudioPlayerButton } from './AudioPlayerButton';
import { SoundEffects } from '../utils/speech';

interface SecurityPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeMode: ThemeMode;
}

export function SecurityPrivacyModal({
  isOpen,
  onClose,
  themeMode,
}: SecurityPrivacyModalProps) {
  const [activeTab, setActiveTab] = useState<'safeguards' | 'helplines'>('safeguards');

  if (!isOpen) return null;

  const isHighContrast = themeMode === 'high-contrast';

  const narrationText =
    'Your Lumina security and privacy protections are fully active. ' +
    'First, your sensitive numbers such as Social Security and bank accounts are automatically masked before any processing. ' +
    'Second, your medical notes and conversation questions are private and never stored or sold. ' +
    'Third, you have direct access to free federal elder fraud hotlines whenever you feel uncertain about a message or phone call.';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="security-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-2 p-6 sm:p-7 shadow-2xl space-y-6 ${
          isHighContrast
            ? 'bg-slate-950 border-emerald-400 text-white'
            : 'bg-white border-emerald-300 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-black/10 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`p-3 rounded-2xl ${
                isHighContrast
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-emerald-100 text-emerald-900'
              }`}
            >
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h3 id="security-modal-title" className="text-2xl font-bold font-serif">
                Security & Privacy Shield
              </h3>
              <p className="text-sm opacity-80 mt-0.5">
                How Lumina keeps your health notes, messages, and identity safe.
              </p>
            </div>
          </div>
          <button
            id="btn-close-security-modal"
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-black/5"
            aria-label="Close security details"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Read Aloud Reassurance Bar */}
        <div
          className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
            isHighContrast
              ? 'bg-slate-900 border-slate-700'
              : 'bg-emerald-50/70 border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold">
              All Security Safeguards Are Active & Verified
            </span>
          </div>
          <AudioPlayerButton
            text={narrationText}
            textId="security-modal-audio"
            label="Read Safety Summary"
            themeMode={themeMode}
          />
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              SoundEffects.playSoftChime();
              setActiveTab('safeguards');
            }}
            className={`flex-1 py-3 text-base font-bold text-center border-b-4 transition-all ${
              activeTab === 'safeguards'
                ? isHighContrast
                  ? 'border-emerald-400 text-emerald-300'
                  : 'border-emerald-600 text-emerald-900'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            🛡️ Privacy & Safeguards
          </button>
          <button
            type="button"
            onClick={() => {
              SoundEffects.playSoftChime();
              setActiveTab('helplines');
            }}
            className={`flex-1 py-3 text-base font-bold text-center border-b-4 transition-all ${
              activeTab === 'helplines'
                ? isHighContrast
                  ? 'border-emerald-400 text-emerald-300'
                  : 'border-emerald-600 text-emerald-900'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            📞 Official Fraud Hotlines
          </button>
        </div>

        {/* Tab 1: Privacy Safeguards */}
        {activeTab === 'safeguards' && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-xl border space-y-2 ${
                isHighContrast ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5 font-bold text-lg text-emerald-800 dark:text-emerald-300">
                <Lock className="w-5 h-5 text-emerald-600" />
                <span>Automatic PII Redaction</span>
              </div>
              <p className="text-base leading-relaxed opacity-90">
                Whenever you paste a doctor's bill, prescription label, or text message, our system automatically scans for and masks Social Security Numbers, credit cards, bank accounts, and PINs (e.g., [PROTECTED SSN: ***-**-****]) before any AI processing.
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border space-y-2 ${
                isHighContrast ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5 font-bold text-lg text-emerald-800 dark:text-emerald-300">
                <EyeOff className="w-5 h-5 text-emerald-600" />
                <span>No Health Data Retention</span>
              </div>
              <p className="text-base leading-relaxed opacity-90">
                Your medical discharge papers, test results, and confidential questions are processed live in-memory and are never permanently stored, shared, or used for advertising.
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border space-y-2 ${
                isHighContrast ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5 font-bold text-lg text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>Server-Side Security & Rate Protection</span>
              </div>
              <p className="text-base leading-relaxed opacity-90">
                All Gemini AI intelligence calls are strictly proxied on our secure server behind encrypted HTTPS with strict HTTP security headers, prompt injection defenses, and rate limiting to prevent unauthorized access.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Fraud Helplines */}
        {activeTab === 'helplines' && (
          <div className="space-y-4">
            <p className="text-sm opacity-80">
              If someone called asking for gift cards, claimed to be a grandchild in jail, or threatened your Social Security benefits, these free federal organizations can help immediately:
            </p>

            <div className="space-y-3">
              {SENIOR_SECURITY_RESOURCES.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border space-y-2 ${
                    isHighContrast
                      ? 'bg-slate-900 border-slate-700'
                      : 'bg-emerald-50/50 border-emerald-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-base">{item.name}</span>
                    <a
                      href={`tel:${item.phone.replace(/[^0-9]/g, '')}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-xs transition-all"
                    >
                      <PhoneCall className="w-4 h-4" />
                      <span>{item.phone}</span>
                    </a>
                  </div>
                  <p className="text-sm opacity-90">{item.description}</p>
                  {item.hours && (
                    <div className="text-xs opacity-75 font-medium">{item.hours}</div>
                  )}
                  {item.website && (
                    <div className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Website: {item.website}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-black/10 dark:border-slate-800 pt-4 flex items-center justify-between">
          <div className="text-xs opacity-70 flex items-center gap-1">
            <HelpCircle className="w-4 h-4" />
            <span>Emergency? Always dial 911 immediately.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`px-6 py-2.5 rounded-xl font-bold text-base transition-all shadow-md ${
              isHighContrast
                ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                : 'bg-emerald-700 text-white hover:bg-emerald-800'
            }`}
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
