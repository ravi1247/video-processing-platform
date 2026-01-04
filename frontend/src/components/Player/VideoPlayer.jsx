import { useEffect, useRef } from 'react';
import { videoAPI } from '../../services/api';

const VideoPlayer = ({ video, onClose }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Get the stream URL with proper authentication
  const getAuthenticatedStreamUrl = () => {
    const token = localStorage.getItem('token');
    const baseUrl = videoAPI.getStreamUrl(video._id);
    
    // Create a custom fetch for the video with auth headers
    return baseUrl;
  };

  // Set up video source with authentication
  useEffect(() => {
    if (videoRef.current) {
      const token = localStorage.getItem('token');
      const streamUrl = videoAPI.getStreamUrl(video._id);
      
      // Use fetch with authorization header
      fetch(streamUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(response => response.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          videoRef.current.src = url;
        })
        .catch(error => {
          console.error('Error loading video:', error);
        });
    }
  }, [video._id]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
        >
          <svg
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            controls
            autoPlay
            className="w-full"
            type={video.mimeType}
          >
            Your browser does not support the video tag.
          </video>

          <div className="bg-gray-900 text-white p-4">
            <h3 className="text-xl font-semibold">{video.title}</h3>
            {video.description && (
              <p className="text-gray-300 mt-2 text-sm">{video.description}</p>
            )}
            
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {video.duration && (
                <div>
                  <span className="text-gray-400">Duration:</span>{' '}
                  <span className="font-medium">
                    {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')}
                  </span>
                </div>
              )}
              
              {video.metadata?.resolution && (
                <div>
                  <span className="text-gray-400">Resolution:</span>{' '}
                  <span className="font-medium">{video.metadata.resolution}</span>
                </div>
              )}
              
              <div>
                <span className="text-gray-400">Status:</span>{' '}
                <span className={`font-medium ${
                  video.sensitivityStatus === 'safe' ? 'text-green-400' : 
                  video.sensitivityStatus === 'flagged' ? 'text-red-400' : 
                  'text-gray-400'
                }`}>
                  {video.sensitivityStatus}
                </span>
              </div>
              
              {video.sensitivityScore !== undefined && (
                <div>
                  <span className="text-gray-400">Score:</span>{' '}
                  <span className="font-medium">{video.sensitivityScore}/100</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;