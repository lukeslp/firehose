import React, { Suspense, lazy } from 'react';
import { useRoute, Link } from 'wouter';

// Lazy load variant components
const MissionControl = lazy(() => import('./variants/MissionControl'));
const CosmicNexus = lazy(() => import('./variants/CosmicNexus'));
const Editorial = lazy(() => import('./variants/Editorial'));
const RetroArcade = lazy(() => import('./variants/RetroArcade'));
const Minimal = lazy(() => import('./variants/Minimal'));
const DashboardPro = lazy(() => import('./variants/DashboardPro'));
const Magazine = lazy(() => import('./variants/Magazine'));

const variants: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  'mission-control': MissionControl,
  'cosmic-nexus': CosmicNexus,
  'editorial': Editorial,
  'retro-arcade': RetroArcade,
  'minimal': Minimal,
  'dashboard-pro': DashboardPro,
  'magazine': Magazine
};

const variantNames: Record<string, string> = {
  'mission-control': 'Mission Control',
  'cosmic-nexus': 'Cosmic Nexus',
  'editorial': 'Editorial',
  'retro-arcade': 'Retro Arcade',
  'minimal': 'Minimal',
  'dashboard-pro': 'Dashboard Pro',
  'magazine': 'Magazine'
};

export default function VariantRouter() {
  const [, params] = useRoute('/variants/:variantId');
  const variantId = params?.variantId || '';

  const VariantComponent = variants[variantId];
  const variantName = variantNames[variantId];

  if (!VariantComponent) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Variant Not Found</h1>
          <p className="text-white/60 mb-6">
            The variant "{variantId}" doesn't exist.
          </p>
          <Link href="/variants">
            <a className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition">
              ← Back to Variants
            </a>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4 mx-auto" />
            <p className="text-xl">Loading {variantName}...</p>
          </div>
        </div>
      }
    >
      <VariantComponent />
    </Suspense>
  );
}
