import React, { useEffect, useState } from 'react';
import { Film } from 'lucide-react';
import ResponsiveImage from '@/components/ResponsiveImage';
import type { INode } from './types';
import { getMimeCategory, CATEGORY_STYLE, vfsUrl, getExt } from './helpers';
import { getSignedVfsGetUrl } from './client-vfs';

// ── NodeIcon ─────────────────────────────────────────────────────

export function NodeIcon({ node, size = 14 }: { node: INode; size?: number }) {
    const cat = getMimeCategory(node);
    const { icon: Icon, color } = CATEGORY_STYLE[cat];
    return <Icon size={size} style={{ color, flexShrink: 0, maxWidth: '100%', maxHeight: '100%' }} />;
}

// ── ThumbPreview ─────────────────────────────────────────────────

export function ThumbPreview({ node, mount, tokenParam = '', thumbSize = 80 }: { node: INode; mount: string; tokenParam?: string; thumbSize?: number }) {
    const cat = getMimeCategory(node);
    const fileUrl = vfsUrl('get', mount, node.path);
    const unsignedUrl = tokenParam ? `${fileUrl}?${tokenParam}` : fileUrl;
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const ext = getExt(node.name);
    const fullUrl = signedUrl;

    useEffect(() => {
        if (cat !== 'image' && cat !== 'video') return;
        let cancelled = false;
        getSignedVfsGetUrl(mount, node.path, { mtime: node.mtime })
            .then((url) => {
                if (!cancelled) setSignedUrl(url);
            })
            .catch(() => {
                if (!cancelled) setSignedUrl(unsignedUrl);
            });
        return () => {
            cancelled = true;
        };
    }, [cat, mount, node.mtime, node.path, unsignedUrl]);

    if (cat === 'image' && ext !== 'dxf' && ext !== 'svg') {
        if (!fullUrl) return <NodeIcon node={node} size={Math.max(24, Math.floor(thumbSize * 0.5))} />;
        return (
            <div style={{ aspectRatio: '1/1', width: '100%', overflow: 'hidden', borderRadius: 4, display: 'flex' }}>
                <ResponsiveImage src={fullUrl} alt={node.name} loading="lazy" responsiveSizes={[128, 256]} className="" imgClassName="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
        );
    }
    if (cat === 'video') {
        if (!fullUrl) return <NodeIcon node={node} size={Math.max(24, Math.floor(thumbSize * 0.5))} />;
        return (
            <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', overflow: 'hidden', borderRadius: 4 }}>
                <video src={fullUrl} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>
                    <Film size={20} style={{ color: '#fff', opacity: 0.8 }} />
                </div>
            </div>
        );
    }
    return <NodeIcon node={node} size={Math.max(24, Math.floor(thumbSize * 0.5))} />;
}
