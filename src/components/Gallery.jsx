import React, { useState, useRef, useEffect } from 'react';
import { Camera, Trash2, X, Plus, Image as ImageIcon, Play, Film, Loader2, Zap, CheckCircle2 } from 'lucide-react';
import { useCollection } from '../hooks/useFirestore';
import { useStorage } from '../hooks/useStorage';

const isVideoItem = (item) => {
    if (!item) return false;
    if (item.mediaType === 'video') return true;
    if (item.mimeType && item.mimeType.startsWith('video/')) return true;
    const target = `${item.name || ''} ${item.filePath || ''} ${item.url || ''}`;
    return /\.(mp4|mov|webm|m4v|3gp|avi|mkv)(\?|$)/i.test(target);
};

const formatMB = (bytes) => {
    if (!bytes || bytes <= 0) return '0.0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const Gallery = () => {
    const { data: photos, loading: photosLoading } = useCollection('photos');
    const {
        uploadFile,
        deleteFile,
        replaceExistingVideoWithFile,
        getCachedVideoBlob,
        ensurePosterForExistingVideo,
        isUploading,
        isOptimizingId,
        progress,
        statusText,
        bytesInfo
    } = useStorage();

    const [selectedImg, setSelectedImg] = useState(null);
    const [resolvedVideoSrc, setResolvedVideoSrc] = useState(null);
    const [isVideoBuffering, setIsVideoBuffering] = useState(false);
    const [replaceTargetItem, setReplaceTargetItem] = useState(null);
    const playerRef = useRef(null);
    const replaceInputRef = useRef(null);
    const activeObjectUrlRef = useRef(null);
    const posterCapturedForIdRef = useRef(new Set());

    useEffect(() => {
        return () => {
            if (activeObjectUrlRef.current) {
                URL.revokeObjectURL(activeObjectUrlRef.current);
                activeObjectUrlRef.current = null;
            }
        };
    }, []);

    const closeModal = () => {
        if (activeObjectUrlRef.current) {
            URL.revokeObjectURL(activeObjectUrlRef.current);
            activeObjectUrlRef.current = null;
        }
        setResolvedVideoSrc(null);
        setSelectedImg(null);
        setIsVideoBuffering(false);
    };

    const openItemModal = async (item) => {
        if (activeObjectUrlRef.current) {
            URL.revokeObjectURL(activeObjectUrlRef.current);
            activeObjectUrlRef.current = null;
        }

        if (!isVideoItem(item)) {
            setResolvedVideoSrc(null);
            setIsVideoBuffering(false);
            setSelectedImg(item);
            return;
        }

        setSelectedImg(item);
        setIsVideoBuffering(true);

        const cachedBlob = await getCachedVideoBlob(item.url);
        if (cachedBlob) {
            const localUrl = URL.createObjectURL(cachedBlob);
            activeObjectUrlRef.current = localUrl;
            setResolvedVideoSrc(localUrl);
            setIsVideoBuffering(false);
        } else {
            setResolvedVideoSrc(item.url);
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|heic|heif|gif)$/i.test(file.name);
            const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp|avi|mkv)$/i.test(file.name);

            if (!isImage && !isVideo) {
                alert('Bitte nur Fotos oder Videos hochladen (z. B. JPG, PNG, MP4, MOV).');
                return;
            }
            await uploadFile(file);
            e.target.value = null;
        }
    };

    const handleReplaceFileSelected = async (e) => {
        const file = e.target.files?.[0];
        const targetItem = replaceTargetItem;
        e.target.value = null;
        setReplaceTargetItem(null);

        if (!file || !targetItem) return;
        try {
            const updated = await replaceExistingVideoWithFile(targetItem, file);
            if (updated && selectedImg?.id === targetItem.id) {
                await openItemModal(updated);
            }
        } catch (err) {
            alert('Komprimierung fehlgeschlagen: ' + err.message);
        }
    };

    const handleDelete = async (e, item, isVideo) => {
        e.stopPropagation();
        if (window.confirm(`Möchtest du dieses ${isVideo ? 'Video' : 'Foto'} wirklich löschen?`)) {
            await deleteFile(item.id, item.filePath, item.thumbPath, item.url);
            if (selectedImg?.id === item.id) closeModal();
        }
    };

    const handleOptimizeVideo = async (e, item) => {
        if (e) e.stopPropagation();
        if (!item) return;

        // 1. Prüfen, ob das Video bereits lokal im Geräte-Cache liegt
        const cachedBlob = await getCachedVideoBlob(item.url);
        if (cachedBlob && cachedBlob.size > 0) {
            try {
                const updated = await replaceExistingVideoWithFile(item, cachedBlob);
                if (updated && selectedImg?.id === item.id) {
                    await openItemModal(updated);
                }
            } catch (err) {
                alert('Komprimierung fehlgeschlagen: ' + err.message);
            }
            return;
        }

        // 2. Da Firebase Storage den Rück-Download einer bereits hochgeladenen 231-MB-Datei
        // im Browser per CORS sperrt, öffnen wir direkt die lokale Dateiauswahl, um das Video
        // ohne Umweg lokal in 1080p Full-HD zu komprimieren und das alte Cloud-Video zu ersetzen.
        setReplaceTargetItem(item);
        if (replaceInputRef.current) {
            replaceInputRef.current.click();
        }
    };

    const handleVideoLoadedData = (item, videoEl) => {
        setIsVideoBuffering(false);
        if (!item || item.posterUrl || posterCapturedForIdRef.current.has(item.id) || !videoEl) return;

        try {
            const vw = videoEl.videoWidth || 960;
            const vh = videoEl.videoHeight || 540;
            const maxDim = 960;
            const scale = Math.min(1, maxDim / Math.max(vw, vh));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(vw * scale));
            canvas.height = Math.max(1, Math.round(vh * scale));
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        posterCapturedForIdRef.current.add(item.id);
                        ensurePosterForExistingVideo(item, blob);
                    }
                },
                'image/jpeg',
                0.90
            );
        } catch {
            // ignore CORS
        }
    };

    const isTrulyOptimized = (p) => Boolean(p.webOptimized && (!p.sizeBytes || p.sizeBytes < 65 * 1024 * 1024));

    return (
        <div className="content-container fade-in">
            {/* Versteckter Datei-Dialog zum direkten lokalen Ersetzen eines alten großen Videos */}
            <input
                ref={replaceInputRef}
                type="file"
                accept="video/*"
                onChange={handleReplaceFileSelected}
                style={{ display: 'none' }}
            />

            {/* Header */}
            <div className="card" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Camera className="icon-green" /> Galerie
                    </h2>
                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Fotos & Videos (1080p Full-HD • Automatisch optimiert)
                    </p>
                </div>

                {/* Upload Button */}
                <label className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={20} />
                    <span>Foto / Video</span>
                    <input type="file" onChange={handleFileChange} style={{ display: 'none' }} accept="image/*,video/*" />
                </label>
            </div>

            {/* Progress Bar */}
            {isUploading && (
                <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.88rem', gap: '8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Loader2 size={15} className="spin-icon" color="var(--kawasaki-green)" />
                            {statusText || 'Verarbeite'} ({Math.round(progress)}%)...
                        </span>
                        {bytesInfo?.total > 0 && (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                {formatMB(bytesInfo.transferred)} / {formatMB(bytesInfo.total)}
                            </span>
                        )}
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#2a2a2a', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{
                            width: `${progress}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #52991e, var(--kawasaki-green))',
                            borderRadius: '99px',
                            transition: 'width 0.15s linear'
                        }}></div>
                    </div>
                </div>
            )}

            {/* Media Grid */}
            <div className="photo-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '1rem'
            }}>
                {!photosLoading && photos.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        <ImageIcon size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>Noch keine Fotos oder Videos.</p>
                        <p style={{ fontSize: '0.8rem' }}>Lade jetzt deine erste Aufnahme hoch!</p>
                    </div>
                )}

                {photos && photos.map(photo => {
                    const isVideo = isVideoItem(photo);
                    return (
                        <div key={photo.id}
                            className="photo-item"
                            onClick={() => openItemModal(photo)}
                            style={{
                                position: 'relative',
                                aspectRatio: '1',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: '#1a1a1a'
                            }}>
                            {isVideo ? (
                                <>
                                    {photo.posterUrl ? (
                                        <img
                                            src={photo.posterUrl}
                                            alt={photo.name || 'Video'}
                                            loading="lazy"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <video
                                            src={`${photo.url}#t=0.001`}
                                            muted
                                            playsInline
                                            preload="metadata"
                                            onLoadedData={(e) => handleVideoLoadedData(photo, e.currentTarget)}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    )}

                                    {/* Play Icon Overlay */}
                                    <div style={{
                                        position: 'absolute',
                                        inset: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'rgba(0,0,0,0.22)',
                                        pointerEvents: 'none'
                                    }}>
                                        <div style={{
                                            width: '44px',
                                            height: '44px',
                                            borderRadius: '50%',
                                            background: 'rgba(105, 190, 40, 0.92)',
                                            color: '#000',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                                        }}>
                                            <Play size={22} fill="#000" style={{ marginLeft: '2px' }} />
                                        </div>
                                    </div>

                                    {/* Video Badge */}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '8px',
                                        left: '8px',
                                        background: 'rgba(0,0,0,0.68)',
                                        color: 'var(--kawasaki-green)',
                                        padding: '3px 7px',
                                        borderRadius: '6px',
                                        fontSize: '0.68rem',
                                        fontWeight: '700',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        backdropFilter: 'blur(4px)',
                                        pointerEvents: 'none'
                                    }}>
                                        <Film size={12} />
                                        {isTrulyOptimized(photo)
                                            ? `Full-HD${photo.sizeBytes ? ` • ${formatMB(photo.sizeBytes)}` : ''}`
                                            : `Video${photo.sizeBytes ? ` (${formatMB(photo.sizeBytes)})` : ''}`}
                                    </div>
                                </>
                            ) : (
                                <img
                                    src={photo.url}
                                    alt="Gallery"
                                    loading="lazy"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                                />
                            )}

                            {/* Overlay Gradient */}
                            <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
                                background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                                pointerEvents: 'none'
                            }} />

                            {/* Delete Button */}
                            <button
                                onClick={(e) => handleDelete(e, photo, isVideo)}
                                style={{
                                    position: 'absolute', top: '8px', right: '8px',
                                    background: 'rgba(0,0,0,0.6)', color: 'white',
                                    border: 'none', borderRadius: '50%',
                                    width: '32px', height: '32px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', backdropFilter: 'blur(4px)'
                                }}>
                                <Trash2 size={16} />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Modal for Fullscreen View */}
            {selectedImg && (
                <div
                    className="modal-backdrop"
                    onClick={closeModal}
                    style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.95)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000, padding: '1rem',
                        animation: 'fadeIn 0.2s ease-out',
                        boxSizing: 'border-box'
                    }}
                >
                    <div
                        style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: '960px',
                            maxHeight: '85vh',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isVideoItem(selectedImg) ? (
                            <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                {isVideoBuffering && (
                                    <div style={{
                                        position: 'absolute',
                                        inset: 0,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        color: 'var(--kawasaki-green)',
                                        zIndex: 2,
                                        pointerEvents: 'none'
                                    }}>
                                        <Loader2 size={36} className="spin-icon" />
                                        <span style={{ fontSize: '0.8rem', color: '#ccc', background: 'rgba(0,0,0,0.6)', padding: '3px 10px', borderRadius: '99px' }}>
                                            Lade 1080p Full-HD Stream...
                                        </span>
                                    </div>
                                )}
                                {resolvedVideoSrc && (
                                    <video
                                        key={resolvedVideoSrc}
                                        ref={playerRef}
                                        src={resolvedVideoSrc}
                                        poster={selectedImg.posterUrl || undefined}
                                        controls
                                        autoPlay
                                        playsInline
                                        preload="auto"
                                        onCanPlay={() => setIsVideoBuffering(false)}
                                        onPlaying={() => setIsVideoBuffering(false)}
                                        onWaiting={() => setIsVideoBuffering(true)}
                                        onLoadedData={(e) => handleVideoLoadedData(selectedImg, e.currentTarget)}
                                        style={{
                                            width: '100%',
                                            maxHeight: '76vh',
                                            borderRadius: '12px',
                                            boxShadow: '0 0 28px rgba(0,0,0,0.8)',
                                            background: '#000',
                                            objectFit: 'contain'
                                        }}
                                    />
                                )}

                                <div style={{
                                    marginTop: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.75rem',
                                    flexWrap: 'wrap'
                                }}>
                                    {!isTrulyOptimized(selectedImg) ? (
                                        <button
                                            type="button"
                                            disabled={isUploading}
                                            onClick={(e) => handleOptimizeVideo(e, selectedImg)}
                                            style={{
                                                background: 'var(--kawasaki-green)',
                                                color: '#000',
                                                fontWeight: '700',
                                                fontSize: '0.82rem',
                                                padding: '8px 16px',
                                                borderRadius: '99px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            {isOptimizingId === selectedImg.id ? (
                                                <>
                                                    <Loader2 size={15} className="spin-icon" />
                                                    {statusText || 'Optimiere...'} ({Math.round(progress)}%)
                                                </>
                                            ) : (
                                                <>
                                                    <Zap size={15} />
                                                    Originaldatei wählen & als 1080p Full-HD ersetzen
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <span style={{
                                            fontSize: '0.78rem',
                                            color: 'var(--kawasaki-green)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}>
                                            <CheckCircle2 size={14} />
                                            1080p Full-HD Stream{selectedImg.sizeBytes ? ` (${formatMB(selectedImg.sizeBytes)})` : ''}
                                        </span>
                                    )}
                                    <span style={{ color: '#999', fontSize: '0.82rem' }}>
                                        {new Date(selectedImg.date).toLocaleDateString('de-DE')}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <img
                                    src={selectedImg.url}
                                    alt="Full view"
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '82vh',
                                        borderRadius: '8px',
                                        boxShadow: '0 0 20px rgba(0,0,0,0.5)'
                                    }}
                                />
                                <div style={{ marginTop: '0.6rem', textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>
                                    {new Date(selectedImg.date).toLocaleDateString('de-DE')}
                                </div>
                            </>
                        )}
                        <button
                            onClick={closeModal}
                            style={{
                                position: 'absolute', top: '-42px', right: 0,
                                background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none',
                                borderRadius: '50%', width: '36px', height: '36px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Gallery;
