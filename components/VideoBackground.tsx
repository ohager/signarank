import React from 'react';
import styles from '../styles/VideoBackground.module.scss';

interface VideoBackgroundProps {
    videoUrl: string;
}

const VideoBackground: React.FC<VideoBackgroundProps> = ({ videoUrl }) => {
    return (
        <div className={styles.videoBackground}>
            <video
                autoPlay
                loop
                muted
                playsInline
                className={styles.video}
            >
                <source src={videoUrl} type="video/mp4" />
            </video>
        </div>
    );
};

export default VideoBackground;