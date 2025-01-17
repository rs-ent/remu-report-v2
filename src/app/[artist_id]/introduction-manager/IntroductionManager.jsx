'use client';

import React, { useState, useEffect, useRef } from 'react';
import { uploadFiles } from '../../firebase/fetch';
import TextEditor from '../../components/client/TextEditor';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useReport, useValuation } from '../../../context/GlobalData';
import { fetchArtist, fetchData ,saveData } from '../../firebase/fetch';
import MemberManager from './MemberManager';
import Toast from '../../components/client/Toast';
import './IntroductionManager.css';

const IntroductionManager = ({ artist_id }) => {

  const [toastMessage, setToastMessage] = useState('');
  const [savedData, setSavedData] = useState({});

  const loadSavedIntroductionData = async() => {
    try {
      const loadedData = await fetchData('Introduction', {comp: 'docId', sign: '==', val: artist_id}, false);
      setSavedData(loadedData);
    } catch (e) {
      console.error('Fetch Saved Introduction Data Failed', e);
    }
  };

  useEffect(() => {
    loadSavedIntroductionData();
  }, [artist_id]);

  
  const [catchPhrase, setCatchPhrase] = useState('');
  const [subCatchPhrase, setSubCatchPhrase] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [logo, setLogo] = useState(null); // 로고의 미리보기 URL
  const [profilePicture, setProfilePicture] = useState(null); // 프로필 사진 상태
  const [uploadProgress, setUploadProgress] = useState(0); // 업로드 진행률
  const [errorMessage, setErrorMessage] = useState('');

  const [introduction, setIntroduction] = useState(''); // 텍스트 내용 상태
  const [isIntroductionEditing, setIsIntroductionEditing] = useState(false); // 편집 모드

  const [galleryImages, setGalleryImages] = useState([]); // 업로드된 이미지 상태

  const [members, setMembers] = useState([]);

  const [teamMembers, setTeamMembers] = useState([]);

  const reportData = useReport();
  const [artistData, setArtistData] = useState({});
  const [newDataKey, setNewDataKey] = useState(''); // State for new data key
  const [newDataValue, setNewDataValue] = useState('');

  const valuationData = useValuation();
  const initialAlbums = valuationData.SV?.sub_data || valuationData.SV?.albums || [];
  const [albums, setAlbums] = useState(initialAlbums);

  useEffect(() => {
    // savedData가 로딩된 후 처리
    if (savedData === null) {
      // savedData 없음 -> BasicData 로드 시도
      (async() => {
        await loadBasicData();
      })();
    } else {
      // savedData 있음
      setCatchPhrase(savedData.catchPhrase || '');
      setSubCatchPhrase(savedData.subCatchPhrase || '');
      setLogo(savedData.logo || null);
      setProfilePicture(savedData.profilePicture || null);
      setIntroduction(savedData.introduction || '');
      setGalleryImages(savedData.galleryImages || []);
      setAlbums(savedData.albums || initialAlbums);
      setMembers(savedData.members || []);
      setTeamMembers(savedData.teamMembers || []);

      if (savedData.additionalData && Object.keys(savedData.additionalData).length > 0) {
        setArtistData(savedData.additionalData);
      } else {
        // 추가 데이터 없으면 basic data 로드
        (async() => {
          await loadBasicData();
        })();
      }
    }
  }, [savedData]);

  const albumFileInputRef = useRef(null);
  const handleAlbumChange = (index, field, value) => {
    setAlbums((prev) => {
      // 1) 기존 albums 배열 복사
      const updated = [...prev];
      // 2) 해당 인덱스의 앨범에 field 값 덮어쓰기
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      // 3) 업데이트된 배열 반환
      return updated;
    });
  };

  const handleRemoveAlbum = (index) => {
    setAlbums((prevAlbums) => {
      // 1) 기존 albums 배열 복사
      const updated = [...prevAlbums];
      // 2) 해당 인덱스의 앨범을 삭제
      updated.splice(index, 1);
      // 3) 업데이트된 배열 반환
      return updated;
    });
  };

  const handleAlbumDragEnd = (result) => {
    if (!result.destination) return;
  
    if (result.source.index === result.destination.index) return;
  
    setAlbums((prevAlbums) => {
      const updated = [...prevAlbums];
      // 1) 드래그한 요소를 잘라내기
      const [movedItem] = updated.splice(result.source.index, 1);
      // 2) 새로운 위치에 삽입
      updated.splice(result.destination.index, 0, movedItem);
      return updated;
    });
  };

  const handleToggleAlbumSelection = (index) => {
    setAlbums((prevAlbums) => {
      // 1) 기존 albums 배열을 복사
      const updated = [...prevAlbums];
      
      // 2) 해당 인덱스의 앨범 isSelected 값을 반전
      updated[index] = {
        ...updated[index],
        isSelected: !updated[index].isSelected,
      };
      
      // 3) 업데이트된 배열 반환
      return updated;
    });
  };

  const handleAddAlbum = async (e) => {
    // 사용자가 업로드한 파일 (단일 파일)
    const file = e.target.files?.[0];
    if (!file) return;
  
    // 파일 확장자 체크
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp'];
    const extension = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      alert(`Invalid file type: ${file.name}. Only ${allowedExtensions.join(', ')} are allowed.`);
      return;
    }
  
    // 업로드 진행률 초기화
    setErrorMessage('');
    setUploadProgress(0);
  
    try {
      // 2) Firebase Storage 업로드 (기존 갤러리 업로드 로직 참고)
      const [uploadedImage] = await uploadFiles(
        [file],
        `albums/${artist_id}/`, // 예: 앨범 이미지를 저장할 폴더 경로
        (index, progress) => {
          setUploadProgress(progress); // 업로드 진행률 업데이트
        }
      );
  
      // 3) 업로드가 성공하면, 새로운 앨범 객체를 생성하여 state에 추가
      setAlbums((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),      // 혹은 다른 랜덤 ID 생성 방식
          album_title: 'New Album',     // 기본값
          img_url: uploadedImage.downloadURL, // 업로드된 이미지 URL
          release_date: '',
          isSelected: false,
          // 이후 필요한 필드들 (장르, 레이블 등)이 있다면 추가
        },
      ]);
  
      console.log('New album uploaded successfully:', uploadedImage.downloadURL);
    } catch (error) {
      console.error('Error uploading album image:', error);
      alert('Failed to upload album image. Please try again.');
    }
  };

  const handleSave = () => {
    // Save logic here
    console.log('Saved CatchPhrase:', catchPhrase);
    setIsEditing(false);
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0]; // 사용자가 업로드한 파일
    if (!file) return;

    setErrorMessage(''); // 이전 에러 메시지 초기화
    setUploadProgress(0); // 업로드 진행률 초기화

    try {
      const [uploadedLogo] = await uploadFiles([file], `logos/${artist_id}/`, (index, progress) => {
        setUploadProgress(progress); // 업로드 진행률 업데이트
      });

      setLogo(uploadedLogo.downloadURL); // 업로드 완료 후 미리보기 URL 설정
      console.log('Logo uploaded successfully:', uploadedLogo.downloadURL);
    } catch (error) {
      console.error('Error uploading logo:', error);
      setErrorMessage('Failed to upload logo. Please try again.');
    }
  };

  const handleProfilePictureChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 파일 형식 확인
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp'];
    const extension = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      setErrorMessage(`Invalid file type. Only ${allowedExtensions.join(', ')} are allowed.`);
      return;
    }

    setErrorMessage(''); // 초기화
    setUploadProgress(0);

    try {
      const [uploadedPicture] = await uploadFiles([file], `profile-pictures/${artist_id}/`, (index, progress) => {
        setUploadProgress(progress);
      });

      setProfilePicture(uploadedPicture.downloadURL); // 업로드 성공 시 미리보기 설정
      console.log('Profile picture uploaded successfully:', uploadedPicture.downloadURL);
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setErrorMessage('Failed to upload profile picture. Please try again.');
    }
  };

  const handleSaveIntroduction = () => {
    console.log('Saved Introduction:', introduction);
    setIsIntroductionEditing(false);
  };

  const handleCancelIntroduction = () => {
    // 필요에 따라 이전 상태로 되돌리거나 현재 상태 유지
    setIsIntroductionEditing(false);
  };    

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files); // 사용자가 선택한 파일 배열
    if (!files.length) return;

    const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp'];
    const newImages = [];

    try {
      for (const file of files) {
        const extension = file.name.split('.').pop().toLowerCase();
        if (!allowedExtensions.includes(extension)) {
          alert(`Invalid file type: ${file.name}. Only WEBP, PNG, JPG, and JPEG are allowed.`);
          continue;
        }

        // Firebase Storage 업로드
        const [uploadedImage] = await uploadFiles([file], `gallery/${artist_id}/`, (index, progress) => {
          setUploadProgress(progress); // 업로드 진행률 표시
        });

        newImages.push({
          url: uploadedImage.downloadURL, // 다운로드 URL
          name: file.name, // 파일 이름
        });
      }

      setGalleryImages((prev) => [...prev, ...newImages]); // 상태에 새로운 이미지 추가
      console.log('Images uploaded successfully:', newImages);
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Failed to upload images. Please try again.');
    }
  };

  const handleRemoveImage = (index) => {
    setGalleryImages((prev) => prev.filter((_, i) => i !== index)); // 특정 이미지 삭제
    console.log(`Removed image at index ${index}`);
  };

  const handleImageDragEnd = (result) => {
    if (!result.destination) return; // 드래그를 취소한 경우 처리하지 않음

    const items = Array.from(galleryImages);
    const [reorderedItem] = items.splice(result.source.index, 1); // 드래그한 항목 제거
    items.splice(result.destination.index, 0, reorderedItem); // 새로운 위치에 삽입

    setGalleryImages(items); // 상태 업데이트
  };

  // 멤버 데이터를 업데이트하는 함수
  const handleUpdateMembers = (updatedMembers) => {
    setMembers(updatedMembers);
    console.log('Updated Members:', updatedMembers); // 디버깅용 로그
  };
  
  const loadBasicData = async () => {
    try {
        const artist = await fetchArtist(reportData.melon_artist_id);
        const formattedArtistData = Object.entries(artist).reduce((acc, [key, value]) => {
          acc[key] = {
            value: value !== undefined ? value : '', // value가 undefined인 경우 빈 문자열로 설정
            displayKey: key.charAt(0).toUpperCase() + key.slice(1), // 예: 'name' -> 'Name'
            priority: 5, // 기본 priority 설정 (필요에 따라 조정 가능)
            visible: true, // 기본 visible 설정
          };
          return acc;
        }, {});
        
        setArtistData(formattedArtistData);

    } catch (error) {
        console.error('Fetch error:', error);
        console.error('Error loading investment points.');
    }
  };

  const [selectedFields, setSelectedFields] = useState({}); // 공개 여부 관리

  const toggleFieldVisibility = (key) => {
    setArtistData((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        visible: !prev[key]?.visible,
      },
    }));
  };

    const handleSaveData = async () => {
      console.log(artistData);

      const dataToSave = {
        catchPhrase,
        subCatchPhrase,
        logo,
        profilePicture,
        introduction,
        galleryImages,
        albums,
        members,
        teamMembers,
        additionalData: artistData,
        
        // 이후 다른 섹션 데이터 추가
      };

      console.log('Data to Save: ', dataToSave);

      try {
        await saveData('Introduction', dataToSave, artist_id);
        setToastMessage('Introduction saved successfully!');
      } catch (error) {
        setErrorMessage('Failed to save Introduction. Please try again.');
        console.error(error);
      }
    };

    /******************************************************************************************* 
     *******************************************************************************************
     **************************************렌 더 링***********************************************
     *******************************************************************************************
    *******************************************************************************************/
  return (
    <div className="introduction-manager">
      <div>
      <button onClick={handleSave}>Save</button>
      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage('')} // Toast가 닫힐 때 상태 초기화
        />
      )}
    </div>
      <h1>Introduction Manager</h1>
      
      {/* CatchPhrase Section */}
      <section className="catchphrase-section">
        <h2>CatchPhrase Title</h2>
        {isEditing ? (
          <div className="catchphrase-editor">
            <textarea
              value={catchPhrase}
              onChange={(e) => setCatchPhrase(e.target.value)}
              placeholder="Enter a catchy phrase for the artist..."
              rows={4}
              className="catchphrase-input"
            />
            <button onClick={handleSave} className="save-button">Save</button>
            <button onClick={() => setIsEditing(false)} className="cancel-button">Cancel</button>
          </div>
        ) : (
          <div className="catchphrase-display whitespace-pre-wrap">
            <p>{catchPhrase || 'No catchphrase yet. Click edit to add one!'}</p>
            <button onClick={() => setIsEditing(true)} className="edit-button">Edit</button>
          </div>
        )}      
        {/* Sub Catch Phrase Section */}
        <section className="sub-catchphrase-section">
          <h3>Sub Catch Phrase</h3>
          {isEditing ? (
            <div className="sub-catchphrase-editor">
              <textarea
                value={subCatchPhrase}
                onChange={(e) => setSubCatchPhrase(e.target.value)}
                placeholder="Enter a supporting phrase for the main catchphrase..."
                rows={3}
                className="sub-catchphrase-input"
              />
              <button onClick={handleSave} className="save-button">Save</button>
              <button onClick={() => setIsEditing(false)} className="cancel-button">Cancel</button>
            </div>
          ) : (
            <div className="sub-catchphrase-display">
              <p>{subCatchPhrase || 'No sub-catchphrase yet. Click edit to add one!'}</p>
              <button onClick={() => setIsEditing(true)} className="edit-button">Edit</button>
            </div>
          )}
        </section>
      </section>

      {/* Logo Upload Section */}
      <section className="logo-upload-section">
        <h2>Upload Logo</h2>
        <input
          type="file"
          accept=".png,.svg,.webp"
          onChange={handleLogoChange}
          className="logo-upload-input"
        />
        {uploadProgress > 0 && uploadProgress < 100 && (
          <p>Uploading... {uploadProgress.toFixed(2)}%</p>
        )}
        {logo && (
          <div className="logo-preview">
            <img src={logo} alt="Logo Preview" className="logo-image" />
          </div>
        )}
        {errorMessage && <p className="error-message">{errorMessage}</p>}
      </section>

      {/* Profile Picture Upload Section */}
      <section className="profile-picture-upload-section">
        <h2>Upload Profile Picture</h2>
        <input
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          onChange={handleProfilePictureChange}
          className="profile-picture-upload-input"
        />
        {uploadProgress > 0 && uploadProgress < 100 && (
          <p>Uploading... {uploadProgress.toFixed(2)}%</p>
        )}
        {profilePicture && (
          <div className="profile-picture-preview">
            <img src={profilePicture} alt="Profile Preview" className="profile-picture-image" />
          </div>
        )}
        {errorMessage && <p className="error-message">{errorMessage}</p>}
      </section>

      {/* Introduction Section */}
      <section className="introduction-section">
        <h2>Artist Introduction</h2>
        <TextEditor
          value={introduction}
          onChange={setIntroduction}
          placeholder="Write a short introduction..."
          readOnly={!isIntroductionEditing} // 동적으로 설정
        />
        <div className="introduction-buttons">
          {isIntroductionEditing ? (
            <>
              <button onClick={handleSaveIntroduction} className="save-button">
                Save
              </button>
              <button onClick={handleCancelIntroduction} className="cancel-button">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setIsIntroductionEditing(true)} className="edit-button">
              Edit
            </button>
          )}
        </div>
      </section>

        {/* Gallery Section */}
        <section className="gallery-section">
          <h2>Gallery</h2>
          <input
            type="file"
            accept="image/png, image/jpeg, image/jpg, image/webp"
            multiple
            onChange={handleImageUpload}
            className="gallery-upload-input"
          />
          {uploadProgress > 0 && uploadProgress < 100 && (
            <p>Uploading... {uploadProgress.toFixed(2)}%</p>
          )}
          <DragDropContext
            onDragEnd={handleImageDragEnd} // 드래그 앤 드롭이 끝났을 때 호출
          >
            <Droppable droppableId="gallery" direction="horizontal">
              {(provided) => (
                <div
                  className="gallery-preview"
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  {galleryImages.map((image, index) => (
                    <Draggable key={image.url} draggableId={image.url} index={index}>
                      {(provided) => (
                        <div
                          className="gallery-item"
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <img
                            src={image.url}
                            alt={`Gallery ${index + 1}`}
                            className="gallery-thumbnail"
                          />
                          <button
                            onClick={() => handleRemoveImage(index)}
                            className="remove-button"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </section>

        {/* 멤버 관리 섹션 */}
        <section className="member-manager-section">
            <h2>Member Management</h2>
            <MemberManager
            members={members}
            onUpdateMembers={handleUpdateMembers} // 콜백 전달
            artist_id={artist_id} // Firebase 업로드를 위한 ID 전달
            />
      </section>

      {/* ============================= */}
      {/*      Albums Management       */}
      {/* ============================= */}
      <section className="albums-section">
        <h2 className="albums-section-title">Albums Management</h2>

        {/* 1) DragDropContext: 앨범 순서 드래그 앤 드롭 */}
        <DragDropContext onDragEnd={handleAlbumDragEnd}>
          <Droppable droppableId="albums-droppable" direction="horizontal">
            {(provided) => (
              <div
                className="albums-grid"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {albums.map((album, index) => (
                  <Draggable
                    key={album.id || index}
                    draggableId={String(album.id || index)}
                    index={index}
                  >
                    {(provided) => (
                      <div
                        className="album-card"
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        {/* 앨범 표지 영역 */}
                        <div className="album-cover">
                          {album.img_url ? (
                            <img
                              src={album.img_url}
                              alt={album.album_title || 'New Album'}
                              className="album-image"
                            />
                          ) : (
                            <div className="album-image-fallback">No Image</div>
                          )}
                        </div>

                        {/* 앨범 기본 정보 영역 */}
                        <div className="album-info">
                          <h3 className="album-title">
                            {album.album_title || 'New Album'}
                          </h3>
                          <p className="album-release-date">
                            {album.release_date || 'Unknown Release Date'}
                          </p>

                          {/* 앨범 편집(제목, 발매일 등) - 필요 시 details/summary or 모달로 확장 가능 */}
                          {album.isSelected && (
                            <div className="album-edit-form">
                              <label>
                                <span>Album Title:</span>
                                <input
                                  type="text"
                                  value={album.album_title || ''}
                                  onChange={(e) =>
                                    handleAlbumChange(index, 'album_title', e.target.value)
                                  }
                                />
                              </label>
                              <label>
                                <span>Release Date:</span>
                                <input
                                  type="text"
                                  value={album.release_date || ''}
                                  onChange={(e) =>
                                    handleAlbumChange(index, 'release_date', e.target.value)
                                  }
                                />
                              </label>
                            </div>
                          )}
                        </div>

                        {/* 체크박스 or 삭제 버튼 등 원하는 UI */}
                        <div className="album-actions">
                          <label>
                            <input
                              type="checkbox"
                              checked={album.isSelected || false}
                              onChange={() => handleToggleAlbumSelection(index)}
                            />
                            Selected
                          </label>
                          <button
                            onClick={() => handleRemoveAlbum(index)}
                            className="remove-album-button"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* 2) 앨범 추가 버튼 (이미지 업로드 → 새 앨범 생성) */}
        <div className="add-album-wrapper">
          {/* 숨겨진 파일 업로드 input */}
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            onChange={handleAddAlbum} 
            style={{ display: 'none' }}
            ref={albumFileInputRef}
          />
          <button
            onClick={() => albumFileInputRef.current?.click()}
            className="add-album-button"
          >
            + Add Album
          </button>
        </div>
      </section>

      {/* New Team Members Section */}
      <section className="team-members-section">
        <h2>기획사 맨파워</h2>
        {teamMembers.map((member, index) => (
          <div key={index} className="team-member">
            {/* Image Upload */}
            <div className="team-member-image">
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;

                  try {
                    const [uploadedImage] = await uploadFiles([file], `team-members/${artist_id}/${index}/`, (idx, progress) => {
                      setUploadProgress(progress);
                    });
                    const updatedTeamMembers = [...teamMembers];
                    updatedTeamMembers[index].image = uploadedImage.downloadURL;
                    setTeamMembers(updatedTeamMembers);
                  } catch (error) {
                    console.error('Error uploading team member image:', error);
                    setErrorMessage('Failed to upload team member image. Please try again.');
                  }
                }}
                className="team-member-upload-input"
              />
              {member.image && (
                <div className="team-member-image-preview">
                  <img src={member.image} alt={`Team Member ${index + 1}`} className="team-member-image-img" />
                </div>
              )}
            </div>

            {/* Text Inputs */}
            <div className="team-member-info">
              <div className="team-member-name-title">
                <input
                  type="text"
                  placeholder="Name"
                  value={member.name}
                  onChange={(e) => {
                    const updatedTeamMembers = [...teamMembers];
                    updatedTeamMembers[index].name = e.target.value;
                    setTeamMembers(updatedTeamMembers);
                  }}
                  className="team-member-name-input"
                />
                <input
                  type="text"
                  placeholder="Title"
                  value={member.title}
                  onChange={(e) => {
                    const updatedTeamMembers = [...teamMembers];
                    updatedTeamMembers[index].title = e.target.value;
                    setTeamMembers(updatedTeamMembers);
                  }}
                  className="team-member-title-input"
                />
              </div>
              <textarea
                placeholder="Experience"
                value={member.experience}
                onChange={(e) => {
                  const updatedTeamMembers = [...teamMembers];
                  updatedTeamMembers[index].experience = e.target.value;
                  setTeamMembers(updatedTeamMembers);
                }}
                className="team-member-experience-textarea"
                rows={3}
              />
              <textarea
                placeholder="Introduction"
                value={member.introduction}
                onChange={(e) => {
                  const updatedTeamMembers = [...teamMembers];
                  updatedTeamMembers[index].introduction = e.target.value;
                  setTeamMembers(updatedTeamMembers);
                }}
                className="team-member-introduction-textarea"
                rows={4}
              />
              <button
                onClick={() => {
                  const updatedTeamMembers = teamMembers.filter((_, i) => i !== index);
                  setTeamMembers(updatedTeamMembers);
                }}
                className="remove-team-member-button"
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={() => {
            setTeamMembers([
              ...teamMembers,
              {
                image: null,
                name: '',
                title: '',
                experience: '',
                introduction: '',
              },
            ]);
          }}
          className="add-team-member-button"
        >
          Add Team Member
        </button>
      </section>

      <section className="field-selection">
        {console.log(artistData)}
        <h2>공개할 데이터 선택</h2>
        {Object.entries(artistData).map(([key, data]) => (
          <div key={key} className="field-option">
            <label>
              <input
                type="checkbox"
                checked={data.visible || false}
                onChange={() => toggleFieldVisibility(key)}
              />
              <strong>{data.displayKey || key}:</strong>
            </label>

        {/* Display Key Input */}
        <div className="display-key-editor">
          <label>
            Display Key:
            <input
              type="text"
              placeholder="Enter display key"
              value={data.displayKey || ''}
              onChange={(e) =>
                setArtistData((prev) => ({
                  ...prev,
                  [key]: {
                    ...prev[key],
                    displayKey: e.target.value,
                  },
                }))
              }
              className="display-key-input"
            />
          </label>
        </div>

        {/* Field Value Editor */}
        <div className="field-value">
          <textarea
            value={data.value || ''}
            onChange={(e) => {
              setArtistData((prev) => ({
                ...prev,
                [key]: {
                  ...prev[key],
                  value: e.target.value,
                },
              }));
            }}
            className="field-value-textarea"
            rows={Math.min(10, (data.value?.toString()?.split('\n')?.length || 5) + 1)}
            onInput={(e) => {
              const textarea = e.target;
              textarea.style.height = 'auto'; // 높이 초기화
              textarea.style.height = `${textarea.scrollHeight}px`; // 내용에 따라 높이 설정
            }}
          />
        </div>

      {/* Priority Slider */}
      <div className="priority-slider">
        <label>
          Priority:
          <input
            type="range"
            min="1"
            max="10"
            value={data.priority || 5}
            onChange={(e) =>
              setArtistData((prev) => ({
                ...prev,
                [key]: {
                  ...prev[key],
                  priority: Number(e.target.value),
                },
              }))
            }
            className="priority-input"
          />
          <span>{data.priority || 5}</span>
        </label>
      </div>
    </div>
  ))}

  {/* Add New Data Section */}
  <div className="add-new-data">
    <h3>새 데이터 추가</h3>
    <input
      type="text"
      placeholder="Enter key"
      value={newDataKey}
      onChange={(e) => setNewDataKey(e.target.value)}
      className="new-data-input"
    />
    <textarea
      placeholder="Enter value (e.g., text, array, or object)"
      value={newDataValue}
      onChange={(e) => setNewDataValue(e.target.value)}
      className="new-data-textarea"
      rows={5}
    />
    <button
      onClick={() => {
        if (!newDataKey.trim()) {
          alert('Key를 입력해주세요.');
          return;
        }
        setArtistData((prev) => ({
          ...prev,
          [newDataKey]: {
            value: newDataValue,
            displayKey: '',
            priority: 5, // 기본 priority를 5로 설정
            visible: true, // 기본 visible을 true로 설정
          },
        }));
        setNewDataKey('');
        setNewDataValue('');
      }}
      className="add-data-button"
    >
      Add Data
    </button>
  </div>
</section>
{/* Save All Button */}
<div className="save-all-section">
    <button onClick={handleSaveData} className="save-all-button">
      Save All
    </button>
    {errorMessage && <p className="error-message">{errorMessage}</p>}
  </div>
    </div>
  );
};

export default IntroductionManager;