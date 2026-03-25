import React from 'react';

interface VideoBackgroundProps {
    videoUrl: string;
}

const VideoBackground: React.FC<VideoBackgroundProps> = ({ videoUrl }) => {
    return (
        <div className="fixed inset-0 z-[-2] overflow-hidden">
            <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute top-[40%] left-1/2 min-w-full min-h-full w-auto h-auto -translate-x-1/2 -translate-y-1/2 object-cover"
            >
                <source src={videoUrl} type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-black/50" />
        </div>
    );
};

export default VideoBackground;
