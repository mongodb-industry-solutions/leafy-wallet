"use client";

import React, { useState } from "react";
import Modal from "@leafygreen-ui/modal";
import { H3, Body } from "@leafygreen-ui/typography";
import Icon from "@leafygreen-ui/icon";
import Image from "next/image";
import Button from "@leafygreen-ui/button";
import { Tabs, Tab } from "@leafygreen-ui/tabs";
import { TALK_TRACK } from "@/lib/const/talkTrack";

const InfoWizard = ({
  tooltipText = "Learn more",
  iconGlyph = "Wizard",
  sections = TALK_TRACK,
}) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);

  return (
    <>
      {/* Bigger button for navbars */}
      <Button
        style={{ margin: "5px" }}
        onClick={() => setOpen((prev) => !prev)}
        leftGlyph={<Icon glyph={iconGlyph} />}
      >
        Tell me more!
      </Button>

      <Modal open={open} setOpen={setOpen} size={"default"} className="z-2">
        <div className="overflow-y-auto h-[500px]">
          <Tabs
            aria-label="info wizard tabs"
            setSelected={setSelected}
            selected={selected}
          >
            {sections.map((tab, tabIndex) => (
              <Tab key={tabIndex} name={tab.heading}>
                {tab.content.map((section, sectionIndex) => (
                  <div key={sectionIndex} className="mb-4">
                    {section.heading && (
                      <H3 style={{ marginTop: "20px", marginBottom: "10px" }}>
                        {section.heading}
                      </H3>
                    )}
                    {section.body &&
                      (Array.isArray(section.body) ? (
                        <ul className="list-disc pl-6">
                          {section.body.map((item, idx) =>
                            typeof item == "object" ? (
                              <li key={idx}>
                                {item.heading}
                                <ul className="list-disc pl-6">
                                  {item.body?.map((subItem, idx) => (
                                    <li key={idx}>
                                      <Body>{subItem}</Body>
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            ) : (
                              <li key={idx}>
                                <Body>{item}</Body>
                              </li>
                            )
                          )}
                        </ul>
                      ) : (
                        <Body>{section.body}</Body>
                      ))}

                    {section.image && (
                      <div className="relative w-full h-[400px] flex justify-center items-center">
                        <Image
                          src={section.image.src}
                          alt={section.image.alt}
                          fill
                          sizes="(max-width: 768px) 90vw, 700px"
                          style={{
                            objectFit: "contain",
                            objectPosition: "center",
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </Tab>
            ))}
          </Tabs>
        </div>
      </Modal>
    </>
  );
};

export default InfoWizard;
