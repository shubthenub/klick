import React, { useContext } from 'react';
import { Card, Avatar, Image, Button } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import { SettingsContext } from '@/context/settings/settings-context';
import css from '@/styles/sharedPostPreview.module.css';

const SharedPostPreview = ({ sharedPost, messageText }) => {
  const { openPostModal } = useContext(SettingsContext);
  
  const handleClick = () => {
    openPostModal(sharedPost.id);
  };

  const renderMedia = () => {
    if (!sharedPost.media || sharedPost.media.length === 0) return null;

    if (sharedPost.media.length === 1) {
      const item = sharedPost.media[0];
      // Handle both 'url' and 'src' properties for media
      const mediaUrl = item.url || item.src;
      const mediaType = item.type || (mediaUrl?.includes('image') ? 'image' : 'video');
      
      if (mediaType === 'image') {
        return (
          <div className={css.singleImage}>
            <Image
              src={mediaUrl}
              alt="Post media"
              width="100%"
              height={200}
              style={{ objectFit: 'cover', borderRadius: '8px' }}
            />
          </div>
        );
      } else if (mediaType === 'video') {
        return (
          <div className={css.singleVideo}>
            <video
              src={mediaUrl}
              controls
              width="100%"
              height={200}
              style={{ borderRadius: '8px' }}
            />
          </div>
        );
      }
    } else {
      // Multiple media items
      return (
        <div className={css.multipleMedia}>
          <div className={css.mediaGrid}>
            {sharedPost.media.slice(0, 4).map((item, index) => {
              const mediaUrl = item.url || item.src;
              const mediaType = item.type || (mediaUrl?.includes('image') ? 'image' : 'video');
              
              return (
                <div key={index} className={css.mediaItem}>
                  {mediaType === 'image' ? (
                    <Image
                      src={mediaUrl}
                      alt={`Media ${index + 1}`}
                      width="100%"
                      height={80}
                      style={{ objectFit: 'cover', borderRadius: '4px' }}
                    />
                  ) : (
                    <video
                      src={mediaUrl}
                      width="100%"
                      height={80}
                      style={{ objectFit: 'cover', borderRadius: '4px' }}
                    />
                  )}
                </div>
              );
            })}
            {sharedPost.media.length > 4 && (
              <div className={css.moreMedia}>
                +{sharedPost.media.length - 4}
              </div>
            )}
          </div>
        </div>
      );
    }
  };

  // Debug log to see what data we're receiving
  console.log('SharedPostPreview received:', { sharedPost, messageText });

  return (
    <Card 
      className={css.sharedPostCard}
      onClick={handleClick}
      hoverable
    >
      <div className={css.postHeader}>
        <Avatar src={sharedPost.author?.image_url} size={32} />
        <div className={css.authorInfo}>
          <div className={css.authorName}>
            {sharedPost.author?.first_name} {sharedPost.author?.last_name}
          </div>
          <div className={css.authorUsername}>
            @{sharedPost.author?.username}
          </div>
        </div>
        <Button 
          type="text" 
          icon={<LinkOutlined />}
          size="small"
          className={css.viewButton}
        />
      </div>

      {messageText && (
        <div className={css.messageText}>
          {messageText}
        </div>
      )}

      <div className={css.postContent}>
        {sharedPost.postText && (
          <div className={css.postText}>
            {sharedPost.postText}
          </div>
        )}
        
        {renderMedia()}
      </div>

    </Card>
  );
};

export default SharedPostPreview;