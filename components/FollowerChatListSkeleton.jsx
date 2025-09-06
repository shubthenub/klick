import React from 'react';
import { Skeleton, Flex } from 'antd';
import { SettingsContext } from '@/context/settings/settings-context';

const FollowerChatListSkeleton = () => {
    const {settings} = React.useContext(SettingsContext);
    // console.log(settings.theme);
    const isDark = String(settings.theme).trim() === 'dark';
    // console.log(isDark);
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <Flex
          key={i}
          align="flex-start"
          gap="0.5rem"
          style={{ padding: '10px', backgroundColor: (isDark) ? 'rgba(12, 12, 12, 1)' : 'rgba(255, 255, 255, 1)'  }}
        >
          <div className="avatar">
            <Skeleton.Avatar active size={35} shape="circle" />
          </div>
          <div style={{ width: '100%' }}>
            <Skeleton
              active
              title={{ width: '80%' }}
              paragraph={{ rows: 1, width: '30%' }}
            />
          </div>
        </Flex>
      ))}
    </>
  );
};

export default FollowerChatListSkeleton;
