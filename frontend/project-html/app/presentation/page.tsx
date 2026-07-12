'use client';

import { useEffect, useState, type ComponentType } from 'react';

export default function PresentationPage() {
  const [Comp, setComp] = useState<ComponentType | null>(null);

  useEffect(() => {
    import('./PresentationClient').then((m) => setComp(() => m.default));
  }, []);

  if (!Comp) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fff', fontSize: 18 }}>로딩 중...</span>
      </div>
    );
  }

  return <Comp />;
}
