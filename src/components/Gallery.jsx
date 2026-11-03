import React, { useState } from 'react';
import { Camera, Trash2, X, Plus, Image as ImageIcon, Play, Film } from 'lucide-react';
import { useCollection } from '../hooks/useFirestore';
import { useStorage } from '../hooks/useStorage';

const isVideoItem = (item) => {
    if (!item) return false;
    if (item.mediaType === 'video') return true;
    if (item.mimeType && item.mimeType.startsWith('video/')) return true;
    const target = `${item.name || ''} ${item.filePath || ''} ${item.url || ''}`;
    return /\.(mp4|mov|webm|m4v|3gp|avi|mkv)(\?|$)/i.test(target);
};

const Gallery = () => {
    const { data: photos, loading: photosLoading } = useCollection('photos');
    const { uploadFile, deleteFile, isUploading, progress } = useStorage();
    const [selectedImg, setSelectedImg] = useState(null);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|heic|heif|gif)$/i.test(file.name);
            const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp|avi|mkv)$/i.test(file.name);

            if (!isImage && !isVideo) {
                alert('Bitte nur Fotos oder Videos hochladen (z. B. JPG, PNG, MP4, MOV).');
                return;
            }
            // Upload
            await uploadFile(file);
            // Reset input
            e.target.value = null;
        }
    };

    const handleDelete = async (e, id, filePath, isVideo) => {
        e.stopPropagation(); // Prevent opening modal
        if (window.confirm(`Möchtest du dieses ${isVideo ? 'Video' : 'Foto'} wirklich löschen?`)) {
            await deleteFile(id, filePath);
            if (selectedImg?.id === id) setSelectedImg(null);
        }
    };

    return (
        <div className="content-container fade-in">
            {/* Header */}
            <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Camera className="icon-green" /> Galerie
                    </h2>
                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Fotos & Videos deiner Touren
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
                    <p style={{ marginBottom: '0.5rem' }}>Lade Datei hoch ({Math.round(progress)}%)...</p>
                    <div style={{ width: '100%', height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: 'var(--kawasaki-green)', transition: 'width 0.2s' }}></div>
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
                            onClick={() => setSelectedImg(photo)}
                            style={{
                                position: 'relative',
                                aspectRatio: '1',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: '#222'
                            }}>
                            {isVideo ? (
                                <>
                                    <video
                                        src={`${photo.url}#t=0.1`}
                                        muted
                                        playsInline
                                        preload="metadata"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    {/* Play Icon Overlay */}
                                    <div style={{
                                        position: 'absolute',
                                        inset: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'rgba(0,0,0,0.25)',
                                        pointerEvents: 'none'
                                    }}>
                                        <div style={{
                                            width: '44px',
                                            height: '44px',
                                            borderRadius: '50%',
                                            background: 'rgba(105, 190, 40, 0.9)',
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
                                        background: 'rgba(0,0,0,0.65)',
                                        color: 'var(--kawasaki-green)',
                                        padding: '3px 7px',
                                        borderRadius: '6px',
                                        fontSize: '0.7rem',
                                        fontWeight: '700',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        backdropFilter: 'blur(4px)',
                                        pointerEvents: 'none'
                                    }}>
                                        <Film size={12} /> Video
                                    </div>
                                </>
                            ) : (
                                <img src={photo.url} alt="Gallery" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }} />
                            )}

                            {/* Overlay Gradient for better text visibility (date) */}
                            <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
                                background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                                pointerEvents: 'none'
                            }} />

                            {/* Delete Button */}
                            <button
                                onClick={(e) => handleDelete(e, photo.id, photo.filePath, isVideo)}
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
                    onClick={() => setSelectedImg(null)}
                    style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.95)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000, padding: '1rem',
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                >
                    <div
                        style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isVideoItem(selectedImg) ? (
                            <video
                                src={selectedImg.url}
                                controls
                                autoPlay
                                playsInline
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '85vh',
                                    borderRadius: '10px',
                                    boxShadow: '0 0 24px rgba(0,0,0,0.7)',
                                    background: '#000'
                                }}
                            />
                        ) : (
                            <img
                                src={selectedImg.url}
                                alt="Full view"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '90vh',
                                    borderRadius: '8px',
                                    boxShadow: '0 0 20px rgba(0,0,0,0.5)'
                                }}
                            />
                        )}
                        <button
                            onClick={() => setSelectedImg(null)}
                            style={{
                                position: 'absolute', top: '-40px', right: 0,
                                background: 'transparent', color: 'white', border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={32} />
                        </button>
                        <div style={{
                            position: 'absolute', bottom: '-30px', left: 0, right: 0, textAlign: 'center', color: '#999', fontSize: '0.9rem'
                        }}>
                            {new Date(selectedImg.date).toLocaleDateString('de-DE')}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Gallery;
