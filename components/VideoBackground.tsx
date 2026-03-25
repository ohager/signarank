import React from 'react';

interface VideoBackgroundProps {
    videoUrl: string;
}

const VideoBackground: React.FC<VideoBackgroundProps> = ({ videoUrl }) => {
    return (
        <div className="fixed inset-0 z-0 overflow-hidden">
            <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute top-1/2 left-1/2 min-w-full min-h-full w-auto h-auto -translate-x-1/2 -translate-y-1/2 object-cover"
            >
                <source src={videoUrl} type="video/mp4" />
            </video>
            {/* Radial vignette: vivid center, dark edges for readability */}
            <div
                className="absolute inset-0"
                style={{
                    background: `
                        radial-gradient(ellipse at center, transparent 20%, rgba(8,6,16,0.5) 70%, rgba(8,6,16,0.85) 100%),
                        linear-gradient(to bottom, rgba(8,6,16,0.3) 0%, transparent 30%, transparent 60%, rgba(8,6,16,0.7) 100%)
                    `
                }}
            />
        </div>
    );
};

export default VideoBackground;
